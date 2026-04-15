import React, { useState, useRef, useEffect, useMemo } from 'react';
import { db } from '../engine/utils/db';
import { useScriptStore } from '../store/useScriptStore';
import { 
  X, Upload, Plus, Activity, ZoomIn, ZoomOut, Maximize, Play, RefreshCcw, Trash2, ChevronRight, HelpCircle, Move
} from 'lucide-react';
import characterData from '../engine/jsons/characters.json';

interface Offset { x: number; y: number }
interface PoseData {
  name: string;
  offsets: { body: Offset; eyes: Offset; mouth: Offset; characterAnim: Offset };
  sprites: {
    body: File | null;
    eyes: (File | null)[];
    mouth: (File | null)[];
    characterAnim: (File | null)[];
    staticCharAnim: File | null;
  };
  animSpeed: number;
  animInterval: { min: number; max: number };
}


function usePreviewUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const newUrl = URL.createObjectURL(file);
    setUrl(newUrl);
    return () => URL.revokeObjectURL(newUrl);
  }, [file]);
  return url;
}

const thumbnailCache = new Map<string, string>();

export const CharacterCreator = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const addCustomCharacter = useScriptStore(state => state.addCustomCharacter);
  
  const [activeDrag, setActiveDrag] = useState<'body' | 'eyes' | 'mouth' | 'characterAnim' | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isLive, setIsLive] = useState(true);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'library' | 'editor'>('library');
  const customCharacters = useScriptStore(state => state.customCharacters);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const [charId, setCharId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [nameColor, setNameColor] = useState('#FFFFFF');
  const [speechFile, setSpeechFile] = useState('speechHigh');
  const [baseScale, setBaseScale] = useState(2.15);

  const [poses, setPoses] = useState<PoseData[]>([{
    name: 'normal',
    offsets: { body: {x: 0, y: 0}, eyes: { x: 0, y: 0 }, mouth: { x: 0, y: 0 }, characterAnim: { x: 0, y: 0 } },
    sprites: { body: null, eyes: [null], mouth: [null], characterAnim: [], staticCharAnim: null },
    animSpeed: 0.12,
    animInterval: { min: 5000, max: 7000 }
  }]);

  const [expandedPose, setExpandedPose] = useState<number>(0);
  const currentPose = poses[expandedPose];

  // Animation Ticker
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => setTick(t => t + 1), (currentPose?.animSpeed || 0.12) * 1000);
    return () => clearInterval(interval);
  }, [isLive, currentPose?.animSpeed]);

  const bodyUrl = usePreviewUrl(currentPose?.sprites.body);

  if (!isOpen) return null;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) {
        setIsPanning(true);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      setPan(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
      return;
    }

    if (!activeDrag || !workspaceRef.current) return;
    
    const moveX = e.movementX / zoom;
    const moveY = e.movementY / zoom;

    setPoses(prev => {
        const next = [...prev];
        const pose = { ...next[expandedPose] };
        const nextOffsets = { ...pose.offsets };

        if (activeDrag === 'body') {
            nextOffsets.body = { x: nextOffsets.body.x + moveX, y: nextOffsets.body.y + moveY };
        } else {
            nextOffsets[activeDrag] = { 
                x: nextOffsets[activeDrag].x + (moveX / baseScale), 
                y: nextOffsets[activeDrag].y + (moveY / baseScale) 
            };
        }

        pose.offsets = nextOffsets;
        next[expandedPose] = pose;
        return next;
    });
  };

  const handlePointerUp = () => {
    setActiveDrag(null);
    setIsPanning(false);
  };

  const handleFileUpload = (pIdx: number, category: keyof PoseData['sprites'], file: File, fIdx?: number) => {
    setPoses(prev => {
      const next = [...prev];
      const targetPose = { ...next[pIdx] };
      const nextSprites = { ...targetPose.sprites };

      if (Array.isArray(nextSprites[category])) {
        const nextArray = [...(nextSprites[category] as any[])];
        nextArray[fIdx!] = file;
        (nextSprites[category] as any) = nextArray;
      } else {
        (nextSprites[category] as any) = file;
      }

      targetPose.sprites = nextSprites;
      next[pIdx] = targetPose;
      return next;
    });
  };

  const addFrameRow = (pIdx: number, category: 'eyes' | 'mouth' | 'characterAnim') => {
    setPoses(prev => {
        const next = [...prev];
        next[pIdx].sprites[category] = [...next[pIdx].sprites[category], null];
        return next;
    });
  };

  const removeFrameRow = (pIdx: number, category: 'eyes' | 'mouth' | 'characterAnim', fIdx: number) => {
    setPoses(prev => {
        const next = [...prev];
        const nextArray = [...next[pIdx].sprites[category]];
        nextArray.splice(fIdx, 1);
        next[pIdx].sprites[category] = nextArray;
        return next;
    });
  };

  const handleSave = async () => {
    if (!charId || !displayName) return alert("ID and Display Name required.");

    if (characterData[charId as keyof typeof characterData]) {
        return alert("Conflict: This ID belongs to a built-in character.");
    }

    const existing = useScriptStore.getState().customCharacters[charId];
    if (existing && viewMode !== 'editor') { 
        return alert("Conflict: This ID is already registered in the database.");
    }

    const finalPoses: Record<string, any> = {};

    for (const pose of poses) {
      const prefix = `custom_${charId}_${pose.name}`;
      const storeImg = async (f: File | null, suffix: string) => {
        if (!f) return null;
        const id = `${prefix}_${suffix}`;
        await db.images.put({ id, data: f });
        return id;
      };
      
      const bodyId = await storeImg(pose.sprites.body, 'body');
      const staticId = await storeImg(pose.sprites.staticCharAnim, 'static');
      const eyeIds = await Promise.all(pose.sprites.eyes.map((f, i) => storeImg(f, `eye_${i}`)));
      const mouthIds = await Promise.all(pose.sprites.mouth.map((f, i) => storeImg(f, `mouth_${i}`)));
      const animIds = await Promise.all(pose.sprites.characterAnim.map((f, i) => storeImg(f, `anim_${i}`)));

      finalPoses[pose.name] = {
        offsets: pose.offsets,
        sprites: {
          body: bodyId,
          eyes: eyeIds.filter(Boolean),
          mouth: mouthIds.filter(Boolean),
          characterAnim: animIds.filter(Boolean),
          staticCharAnim: staticId,
          animInterval: pose.animInterval,
          animSpeed: pose.animSpeed
        },
      };
    }

    const oldUrl = thumbnailCache.get(charId);
    if (oldUrl) {
        URL.revokeObjectURL(oldUrl);
        thumbnailCache.delete(charId);
    }

    addCustomCharacter({ id: charId, displayName, nameColor, speechFile, baseScale, poses: finalPoses, isCustom: true });
    onClose();
  };

  const blobToFile = (blob: Blob, fileName: string): File => {
    return new File([blob], fileName, { type: blob.type });
  };

  const handleEdit = async (charId: string) => {
    const char = customCharacters[charId];
    if (!char) return;

    setCharId(char.id);
    setDisplayName(char.displayName);
    setNameColor(char.nameColor);
    setSpeechFile(char.speechFile);
    setBaseScale(char.baseScale);

    const hydratedPoses: PoseData[] = [];

    for (const [poseName, poseData] of Object.entries(char.poses)) {
      const p = poseData as any;
      
      const getFile = async (id: string | null) => {
        if (!id) return null;
        const entry = await db.images.get(id);
        return entry ? blobToFile(entry.data as Blob, `${id}.png`) : null;
      };

      const pose: PoseData = {
        name: poseName,
        offsets: p.offsets,
        animSpeed: p.animSpeed || 0.12,
        animInterval: p.animInterval || { min: 5000, max: 7000 },
        sprites: {
          body: await getFile(p.sprites.body),
          staticCharAnim: await getFile(p.sprites.staticCharAnim),
          eyes: await Promise.all(p.sprites.eyes.map(getFile)),
          mouth: await Promise.all(p.sprites.mouth.map(getFile)),
          characterAnim: await Promise.all(p.sprites.characterAnim.map(getFile)),
        }
      };
      hydratedPoses.push(pose);
    }

    setPoses(hydratedPoses);
    setViewMode('editor');
  };

  const deleteCharacter = async (id: string) => {
    if (!window.confirm(`Are you sure you want to delete ${id}? This cannot be undone.`)) return;

    useScriptStore.getState().deleteCustomCharacter(id);

    const allKeys = await db.images.toCollection().primaryKeys();
    const keysToDelete = allKeys.filter(key => typeof key === 'string' && key.startsWith(`custom_${id}_`));
    await db.images.bulkDelete(keysToDelete);
  };

  const startNewCharacter = () => {
    setCharId('');
    setDisplayName('');
    setPoses([{
        name: 'normal',
        offsets: { body: {x:0, y:0}, eyes: {x:0, y:0}, mouth: {x:0, y:0}, characterAnim: {x:0, y:0} },
        sprites: { body: null, eyes: [null], mouth: [null], characterAnim: [], staticCharAnim: null },
        animSpeed: 0.12,
        animInterval: { min: 5000, max: 7000 }
    }]);
    setViewMode('editor');
  };

  const CharacterThumbnail = ({ char }: { char: any }) => {
    const [imgUrl, setImgUrl] = useState<string | null>(() => {
      return thumbnailCache.get(char.id) || null;
    });

    const characterId = char.id;

    useEffect(() => {

      setImgUrl(thumbnailCache.get(characterId) || null);

      const cached = thumbnailCache.get(characterId);
      if (cached) {
        setImgUrl(cached);
        return;
      }

      let isMounted = true;
      const fetchPreview = async () => {
        const cached = thumbnailCache.get(characterId);

        if (cached) {
          if (isMounted) {
            setImgUrl(cached);
          }
          return;
        }

        const firstPoseName = Object.keys(char.poses)[0];
        const firstPose = char.poses[firstPoseName];
        const bodyId = firstPose.sprites.body;

        if (bodyId) {
          const entry = await db.images.get(bodyId);
          if (entry && entry.data && isMounted) {
            const url = URL.createObjectURL(entry.data as Blob);

            thumbnailCache.set(characterId, url);
            setImgUrl(url);
          }
        }
      };

      fetchPreview();

      return () => {
        isMounted = false;
      };
    }, [characterId, char]);

    if (!imgUrl) {
      return <div className="text-[8px] text-zinc-800 uppercase animate-pulse">Scanning...</div>;
    }

    return (
        <img 
          src={imgUrl} 
          className="max-h-full max-w-full object-contain pixelated" 
          alt="Preview" 
        />
    );
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/98 backdrop-blur-xl flex items-center justify-center p-4 font-mono select-none overflow-hidden" 
         onContextMenu={e => e.preventDefault()}
         onPointerUp={handlePointerUp}>
      <div className="bg-[#0a0a0c] border border-zinc-800 w-full max-w-[98vw] h-[95vh] flex flex-col shadow-2xl">
        
        <EditorGuide isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

        {/* Header */}
        <div className="p-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/40 text-pink-500">
          <div className="flex items-center gap-3">
            <Activity size={16} />
            <h2 className="text-[10px] font-bold tracking-[0.4em] uppercase">Character Laboratory // BTC-7 Protocol</h2>
            <button onClick={() => setViewMode('library')} className="text-[10px] uppercase mr-4 tracking-tighter px-3 py-1.5 rounded-md bg-zinc-700 text-zinc-100 hover:bg-zinc-500 hover:text-white transition-all duration-200">
              [ Back to Database ]
            </button>
                    <button 
                onClick={() => setIsGuideOpen(true)} 
                className="text-[10px] uppercase tracking-tighter px-3 py-1.5 rounded-md bg-amber-900/20 text-amber-500 border border-amber-900/50 hover:bg-amber-900/40 transition-all flex items-center gap-2"
            >
                <HelpCircle size={12} /> System Manual
            </button>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors"><X size={18}/></button>
        </div>

        {/* View Mode: LIBRARY (The List) */}
        {viewMode === 'library' && (
          <div className="flex-1 flex flex-col p-8 overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-zinc-500 uppercase tracking-widest text-xs font-bold">Character Database</h3>
              <button onClick={startNewCharacter} className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest">
                + Add New Character
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.values(customCharacters).map((char: any) => (
                <div key={char.id} className="bg-zinc-900/40 border border-zinc-800 p-4 rounded group hover:border-pink-500/50 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-xs font-bold text-zinc-100 uppercase">{char.displayName}</div>
                      <div className="text-[9px] text-zinc-600 font-mono italic">{char.id}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(char.id)} className="p-1.5 text-zinc-500 hover:text-cyan-400"><Move size={14}/></button>
                      <button onClick={() => deleteCharacter(char.id)} className="p-1.5 text-zinc-500 hover:text-red-500"><Trash2 size={14}/></button>
                    </div>
                  </div>
                  <div className="h-40 bg-black/40 rounded flex items-center justify-center border border-zinc-900 overflow-hidden p-2">
                    <CharacterThumbnail char={char} />
                  </div>

                  <div className="mt-3 flex justify-between items-center">
                    <span className="text-[8px] text-zinc-700 uppercase">{Object.keys(char.poses).length} Poses</span>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: char.nameColor }}></div>
                  </div>
                  
                </div>
              ))}
              {Object.keys(customCharacters).length === 0 && (
                <div className="col-span-full py-20 text-center text-zinc-700 text-xs border border-dashed border-zinc-900">
                  NO CUSTOM CHARACTERS FOUND IN DATABASE
                </div>
              )}
            </div>
          </div>
        )}

        {/* View Mode: EDITOR */}
        {viewMode === 'editor' && (
        <div className="flex-1 flex overflow-hidden">
          
          {/* LEFT SIDEBAR */}
          <div className="w-[360px] overflow-y-auto p-5 space-y-6 border-r border-zinc-800 bg-[#0d0d0f] custom-scrollbar text-zinc-400">
            <section className="space-y-4 p-4 bg-zinc-900/10 border border-zinc-800 rounded">
               <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest border-b border-zinc-800 pb-2">Global Specs</div>
               <Input label="Internal ID" value={charId} onChange={setCharId} placeholder="stella_oc" />
               <Input label="Display Name" value={displayName} onChange={setDisplayName} placeholder="Stella" />
               <div className="pt-2">
                  <div className="flex justify-between items-center mb-2">
                      <label className="text-[8px] text-zinc-500 uppercase font-bold tracking-tighter">Render Scale</label>
                      <span className="text-[10px] text-cyan-500 font-mono font-bold">{baseScale.toFixed(2)}x</span>
                  </div>
                  <input type="range" min="0.5" max="4.0" step="0.01" value={baseScale} onChange={e => setBaseScale(parseFloat(e.target.value))} className="w-full accent-pink-600 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer" />
               </div>
               <div className="grid grid-cols-2 gap-3 mt-2">
                 <div>
                    <label className="text-[8px] text-zinc-600 uppercase font-bold block mb-1">Voice</label>
                    <select value={speechFile} onChange={e => setSpeechFile(e.target.value)} className="w-full bg-black border border-zinc-800 p-1 text-[10px] text-zinc-300 outline-none"><option value="speechHigh">High</option><option value="speechLow">Low</option></select>
                 </div>
                 <div>
                    <label className="text-[8px] text-zinc-600 uppercase font-bold block mb-1">Color</label>
                    <input type="color" value={nameColor} onChange={e => setNameColor(e.target.value)} className="w-full h-7 bg-transparent border border-zinc-800 p-0.5 cursor-pointer" />
                 </div>
               </div>
            </section>

            <section className="space-y-3 pb-20">
              <button onClick={() => setPoses([...poses, { name: `pose_${poses.length}`, offsets: { body: {x:0,y:0}, eyes: {x:-43,y:0}, mouth: {x:0,y:0}, characterAnim: {x:0,y:0} }, sprites: { body: null, eyes: [null], mouth: [null], characterAnim: [], staticCharAnim: null }, animSpeed: 0.12, animInterval: { min: 5000, max: 7000 } }])} className="w-full text-[8px] text-cyan-500 font-bold border border-cyan-900/30 p-2 hover:bg-cyan-950 transition-colors uppercase">+ New Pose</button>
              {poses.map((pose, pIdx) => (
                <div key={pIdx} className={`border rounded overflow-hidden ${expandedPose === pIdx ? 'border-pink-500/40 bg-pink-500/5' : 'border-zinc-800 bg-zinc-900/10'}`}>
                  <button className="w-full p-3 flex justify-between items-center text-left uppercase" onClick={() => setExpandedPose(pIdx)}>
                    <span className={`text-[10px] font-bold ${expandedPose === pIdx ? 'text-zinc-100' : 'text-zinc-500'}`}>{pose.name}</span>
                    <ChevronRight size={12} className={expandedPose === pIdx ? 'text-pink-500 rotate-90 transition-transform' : 'text-zinc-700'}/>
                  </button>
                  {expandedPose === pIdx && (
                    <div className="p-4 pt-0 space-y-4 border-t border-zinc-800/50">
                      <Input label="Pose Key" value={pose.name} onChange={(v:any) => {const n=[...poses]; n[pIdx].name=v; setPoses(n)}} />
                      <div className="pt-2 space-y-2 border-t border-zinc-900 mt-2">
                        <AssetInput label="BASE BODY" onChange={(f:any) => handleFileUpload(pIdx, 'body', f)} />
                        <AssetInput label="STATIC PROP" onChange={(f:any) => handleFileUpload(pIdx, 'staticCharAnim', f)} />
                      </div>
                      <div className="space-y-6">
                        <DynamicList title="EYE FRAMES" list={pose.sprites.eyes} onAdd={() => addFrameRow(pIdx, 'eyes')} onUpload={(file: File, index: number) => handleFileUpload(pIdx, 'eyes', file, index)} onRemove={(i: number) => removeFrameRow(pIdx, 'eyes', i)} />
                        <DynamicList title="MOUTH FRAMES" list={pose.sprites.mouth} onAdd={() => addFrameRow(pIdx, 'mouth')} onUpload={(file: File, index: number) => handleFileUpload(pIdx, 'mouth', file, index)} onRemove={(i: number) => removeFrameRow(pIdx, 'mouth', i)} />
                        <DynamicList title="ANIMATION" list={pose.sprites.characterAnim} onAdd={() => addFrameRow(pIdx, 'characterAnim')} onUpload={(file: File, index: number) => handleFileUpload(pIdx, 'characterAnim', file, index)} onRemove={(i: number) => removeFrameRow(pIdx, 'characterAnim', i)} />
                      </div>
                      <div className="pt-4 border-t border-zinc-800 grid grid-cols-2 gap-4">
                        <Input label="Optional Animation Speed (not applies to eyes or mouth)" type="number" step="0.01" value={pose.animSpeed} onChange={v => {const n=[...poses]; n[pIdx].animSpeed=parseFloat(v) || 0.12; setPoses(n)}} />
                        <div className="flex gap-2">
                          <Input label="Animation intrvl min, ms" type="number" value={pose.animInterval.min} onChange={v => {const n=[...poses]; n[pIdx].animInterval.min=parseInt(v) || 0; setPoses(n)}} />
                          <Input label="Animation intrvl max, ms" type="number" value={pose.animInterval.max} onChange={v => {const n=[...poses]; n[pIdx].animInterval.max=parseInt(v) || 0; setPoses(n)}} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </section>
          </div>

          {/* RIGHT: VIEWPORT */}
          <div className="flex-1 bg-[#050506] relative flex flex-col overflow-hidden" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}>
            <div className="absolute top-4 left-4 z-50 flex gap-2">
                <button onClick={() => setIsLive(!isLive)} className={`flex items-center gap-2 px-3 py-1.5 rounded border text-[9px] font-bold ${isLive ? 'bg-pink-600 border-pink-400 text-white shadow-lg' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                    {isLive ? <RefreshCcw size={12} className="animate-spin-slow" /> : <Play size={12} />} {isLive ? 'LIVE' : 'STATIC'}
                </button>
            </div>

            <div className="absolute top-4 right-4 z-50 flex items-center bg-black/80 border border-zinc-800 rounded p-1 shadow-2xl backdrop-blur-sm">
              <button onClick={() => setZoom(Math.max(0.1, zoom - 0.1))} className="p-1.5 hover:bg-zinc-800 text-zinc-400"><ZoomOut size={14}/></button>
              <span className="text-[9px] font-bold w-12 text-center text-zinc-500 uppercase">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(Math.min(5, zoom + 0.1))} className="p-1.5 hover:bg-zinc-800 text-zinc-400"><ZoomIn size={14}/></button>
              <button onClick={() => { setZoom(1); setPan({x:0,y:0}); }} className="p-1.5 hover:bg-zinc-800 text-zinc-400 border-l border-zinc-800 ml-1"><Maximize size={14}/></button>
            </div>

            <div className="flex-1 flex items-center justify-center bg-[radial-gradient(#111_1px,transparent_1px)] [background-size:24px_24px]">
              <div style={{ width: `700px`, height: `515px`, position: 'relative', border: '1px solid rgba(236, 72, 153, 0.2)', backgroundColor: '#000', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, imageRendering: 'pixelated', overflow: 'hidden' }}>
                <div ref={workspaceRef} className="absolute" style={{ left: '50%', bottom: '0', transform: `translate(-50%, 0) translate(${currentPose.offsets.body.x}px, ${currentPose.offsets.body.y}px)`, width: 'fit-content', height: 'fit-content' }}>
                    <div onPointerDown={(e) => { e.stopPropagation(); setActiveDrag('body'); }} style={{ transform: `scale(${baseScale})`, transformOrigin: 'bottom center', width: 'fit-content', height: 'fit-content', position: 'relative' }} className="cursor-move">
                        {bodyUrl ? <img src={bodyUrl} className="block pointer-events-none" style={{ width: 'auto', height: 'auto', maxWidth: 'none' }} alt="body" /> : <div className="w-[100px] h-[200px] border border-dashed border-zinc-800 flex items-center justify-center text-[8px]">Empty Body</div>}
                        <AnimatedDraggableOverlay label="ANIM" files={currentPose?.sprites.characterAnim} staticFile={currentPose?.sprites.staticCharAnim} tick={tick} offset={currentPose?.offsets.characterAnim} isActive={activeDrag === 'characterAnim'} onSelect={() => setActiveDrag('characterAnim')} color="border-cyan-500" isLive={isLive} />
                        <AnimatedDraggableOverlay label="EYES" files={currentPose?.sprites.eyes} tick={tick} offset={currentPose?.offsets.eyes} isActive={activeDrag === 'eyes'} onSelect={() => setActiveDrag('eyes')} color="border-pink-500" isLive={isLive} />
                        <AnimatedDraggableOverlay label="MOUTH" files={currentPose?.sprites.mouth} tick={tick} offset={currentPose?.offsets.mouth} isActive={activeDrag === 'mouth'} onSelect={() => setActiveDrag('mouth')} color="border-yellow-500" isLive={isLive} />
                    </div>
                </div>
              </div>
            </div>

            <div className="bg-[#0a0a0c] border-t border-zinc-900 p-3 flex justify-center gap-6">
               <OffsetReadout label="Body" offset={currentPose?.offsets.body} />
               <OffsetReadout label="Eyes" offset={currentPose?.offsets.eyes} />
               <OffsetReadout label="Mouth" offset={currentPose?.offsets.mouth} />
               <OffsetReadout label="Prop" offset={currentPose?.offsets.characterAnim} />
            </div>
          </div>
        </div>
        )}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex justify-between items-center px-8">
           <div className="text-[9px] text-zinc-600 tracking-widest uppercase">Hold Right-Click to Pan Area | Drag features to align</div>
           <button onClick={handleSave} className="bg-pink-600 hover:bg-pink-500 text-white font-bold px-12 py-3 text-[10px] uppercase tracking-[0.4em] shadow-lg transition-all active:scale-[0.98]">Save</button>
        </div>
      </div>
    </div>
  );
};

const AnimatedDraggableOverlay = ({ files, staticFile, tick, offset, label, isActive, onSelect, color, isLive }: any) => {
  const filteredFiles = useMemo(() => files.filter((f: any) => f !== null), [files]);
  const currentFile = useMemo(() => {
    if (staticFile && (!isLive || filteredFiles.length === 0)) return staticFile;
    if (filteredFiles.length === 0) return null;
    if (!isLive) return filteredFiles[0];
    return filteredFiles[tick % filteredFiles.length];
  }, [isLive, tick, filteredFiles, staticFile]);

  const url = usePreviewUrl(currentFile);
  if (!url || !offset) return null;

  return (
    <div onPointerDown={(e) => { e.stopPropagation(); onSelect(); }} className={`absolute cursor-move border z-20 ${isActive ? color + ' bg-white/10 z-50 shadow-none' : 'border-transparent opacity-90'}`} style={{ left: `${offset.x}px`, top: `${offset.y}px` }}>
      <img src={url} className="pointer-events-none block max-w-none" style={{ width: 'auto', height: 'auto' }} alt={label} />
      <div className={`absolute -top-4 left-0 text-[5px] font-bold px-1 whitespace-nowrap tracking-widest ${isActive ? 'bg-white text-black' : 'bg-black/80 text-zinc-500'}`}>{label}</div>
    </div>
  );
};

const Input = ({ label, value, onChange, placeholder, type = "text", step }: any) => (
  <div className="flex flex-col gap-1">
    <label className="text-[8px] text-zinc-600 uppercase font-bold tracking-tighter">{label}</label>
    <input type={type} step={step} value={value} onChange={e => onChange(e.target.value)} className="bg-black border border-zinc-800 p-1.5 text-[10px] text-zinc-200 outline-none focus:border-zinc-600 rounded-sm w-full transition-colors" placeholder={placeholder} />
  </div>
);

const AssetInput = ({ label, onChange }: any) => (
  <div className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 p-2 rounded-sm hover:border-zinc-700 transition-colors mt-1">
    <span className="text-[8px] text-zinc-500 uppercase font-bold">{label}</span>
    <input type="file" id={label} className="hidden" onChange={e => e.target.files?.[0] && onChange(e.target.files[0])} />
    <label htmlFor={label} className="cursor-pointer text-cyan-600 hover:text-cyan-400"><Upload size={14}/></label>
  </div>
);

const DynamicList = ({ title, list, onAdd, onUpload, onRemove }: any) => (
  <div className="space-y-1.5">
    <div className="flex justify-between items-center border-b border-zinc-800 pb-0.5">
      <span className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{title}</span> 
      <button onClick={onAdd} className="text-cyan-700 hover:text-cyan-400 transition-colors"><Plus size={12}/></button>
    </div>
    <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
      {list.map((file: any, i: number) => (
        <div key={i} className="flex items-center gap-2 bg-black border border-zinc-800 p-1 rounded-sm group/row hover:border-zinc-700">
          <span className="text-[7px] text-zinc-800 w-3 font-bold">#{i+1}</span>
          <div className="w-4 h-4 bg-zinc-900 rounded-sm flex items-center justify-center border border-zinc-800 overflow-hidden">
             <ThumbnailPreview file={file} />
          </div>
          <input type="file" id={`${title}-${i}`} className="hidden" onChange={e => e.target.files?.[0] && onUpload(e.target.files[0], i)} />
          <label htmlFor={`${title}-${i}`} className="flex-1 text-[9px] text-zinc-600 truncate cursor-pointer hover:text-zinc-300 font-bold uppercase tracking-tighter">{file ? file.name : 'empty'}</label>
          <button onClick={() => onRemove(i)} className="opacity-0 group-hover/row:opacity-100 text-zinc-700 hover:text-red-500 transition-opacity"><Trash2 size={10} /></button>
        </div>
      ))}
    </div>
  </div>
);

const ThumbnailPreview = ({ file }: { file: File | null }) => {
    const url = usePreviewUrl(file);
    if (!url) return <div className="text-[6px] text-zinc-800">?</div>;
    return <img src={url} className="w-full h-full object-contain pixelated" />;
};

const OffsetReadout = ({ label, offset }: any) => (
  <div className="flex flex-col items-center">
    <div className="text-[7px] text-zinc-700 uppercase font-bold mb-1 tracking-widest">{label}</div>
    <div className="text-[10px] text-cyan-600 font-mono tracking-tighter bg-black px-4 py-1 border border-zinc-900 rounded">X:{Math.round(offset?.x)} Y:{Math.round(offset?.y)}</div>
  </div>
);

const EditorGuide = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 font-mono" onClick={onClose}>
      <div 
        className="bg-[#0d0d0f] border border-amber-900/50 w-full max-w-2xl max-h-[80vh] overflow-y-auto p-8 shadow-2xl relative"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={20}/></button>
        
        <h2 className="text-amber-500 text-sm font-bold tracking-[0.3em] uppercase mb-6 border-b border-amber-900/30 pb-2">
          Everything you do here is local only!
        </h2>

        <div className="space-y-6 text-xs leading-relaxed text-zinc-400">
          <section>
            <h3 className="text-zinc-100 uppercase mb-2 font-bold">1. Coordinate System</h3>
            <p>Characters are anchored at the <span className="text-cyan-500">Bottom-Center</span>. Ensure your Body sprite is cropped exactly at the feet for correct placement.</p>
          </section>

          <section>
            <h3 className="text-zinc-100 uppercase mb-2 font-bold">2. Feature Alignment</h3>
            <ul className="list-disc ml-4 space-y-1">
              <li>Select a layer (Body, Eyes, Mouth, etc.) in the sidebar.</li>
              <li><span className="text-pink-500 font-bold">Drag & Drop</span> features directly on the preview to align them.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-zinc-100 uppercase mb-2 font-bold">3. Mouth and Eyes</h3>
            <p>Mouth and eyes animations will play frames as is, meaning that the best practice is to have all your frames with equal resolution or they might shift</p>
          </section>

          <section>
            <h3 className="text-zinc-100 uppercase mb-2 font-bold">4. Optional Animations</h3>
            <p>If <span className="text-zinc-200">Min/Max Int</span> are set, the animation will trigger once and then wait for a random duration (in milliseconds). Set to 0 or leave empty for a constant loop.</p>
            <p>If optional animation frames are not present, static prop will not appear. It's needed basically to have a placeholder when your animation is not playing (like Stella's ears)</p>
          </section>

          <section>
            <h3 className="text-zinc-100 uppercase mb-2 font-bold text-red-500">5. Critical Notice</h3>
            <p>Data is stored in <span className="text-zinc-200">IndexedDB</span>. Clearing browser cache or private data will result in permanent loss of all custom character patterns.</p>
          </section>

          <section>
            <h3 className="text-zinc-100 uppercase mb-2 font-bold text-red-500">6. Things can break</h3>
          </section>
        </div>

        <div className="mt-8 pt-4 border-t border-zinc-900 text-center">
          <button onClick={onClose} className="text-[10px] text-amber-500 uppercase border border-amber-900/50 px-6 py-2 hover:bg-amber-900/20">
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
};