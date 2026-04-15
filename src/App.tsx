import { Preview } from './components/Preview';
import { useScriptStore, type SlotCharacter } from './store/useScriptStore';
import characterData from './engine/jsons/characters.json';
import { ProjectSidebar } from './components/ProjectSidebar';
import { Play, Copy, Plus, Trash2, Eraser, Music, Settings, Activity } from 'lucide-react'; 
import { JukeboxModal } from './components/JukeboxModal';
import { useState } from 'react';
import { CharacterCreator } from './components/CharacterCreator';

export default function Maker() {
  const { frames, currentIndex, addFrame, selectFrame, duplicateFrame, deleteFrame, updateCurrentFrame, isPlaying, setIsPlaying, clearAllFrames, playlist, customCharacters } = useScriptStore();
  const currentFrame = frames[currentIndex];
  const [isJukeboxOpen, setIsJukeboxOpen] = useState(false);
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const[isCreatorOpen, setIsCreatorOpen] = useState(false);
  
  const allCharacters = { ...characterData, ...customCharacters };
  
  const validCharacterKeys = Object.keys(allCharacters).filter(
    id => (allCharacters as any)[id]?.poses && Object.keys((allCharacters as any)[id].poses).length > 0
  );

  const updatePose = (slot: 'left' | 'center' | 'right', pose: string) => {
    const newCharacters = { ...currentFrame.characters };
    if (newCharacters[slot]) {
      newCharacters[slot] = { ...newCharacters[slot]!, pose };
    }
    updateCurrentFrame({ characters: newCharacters });
  };

  const toggleSpeaking = (slot: 'left' | 'center' | 'right', isSpeaking: boolean) => {
    updateCurrentFrame({
      speaker: {
        ...currentFrame.speaker,
        mouthTarget: isSpeaking ? slot : null
      }
    });
  };

  const addCharacterToSlot = (slot: 'left' | 'center' | 'right') => {
    const newCharacters = { ...currentFrame.characters };
    const firstId = validCharacterKeys[0];
    if (!firstId) return;
    
    const firstPose = Object.keys((allCharacters as any)[firstId].poses)[0];
    newCharacters[slot] = [...newCharacters[slot], { id: firstId, pose: firstPose, xOffset: 0 }];
    updateCurrentFrame({ characters: newCharacters });
  };

  const removeCharacterFromSlot = (slot: 'left' | 'center' | 'right', index: number) => {
    const newCharacters = { ...currentFrame.characters };
    newCharacters[slot] = newCharacters[slot].filter((_, i) => i !== index);
    updateCurrentFrame({ characters: newCharacters });
  };

  const updateCharacterInSlot = (slot: 'left' | 'center' | 'right', index: number, data: Partial<SlotCharacter>) => {
    const newCharacters = { ...currentFrame.characters };
    newCharacters[slot][index] = { ...newCharacters[slot][index], ...data };
    
    if (data.id) {
      const newId = data.id;
      newCharacters[slot][index].pose = Object.keys((allCharacters as any)[newId].poses)[0];
    }
    
    updateCurrentFrame({ characters: newCharacters });
  };

  return (
    <div className="flex h-screen bg-black text-zinc-300 font-mono overflow-hidden">
      <CharacterCreator isOpen={isCreatorOpen} onClose={() => setIsCreatorOpen(false)} />
      <JukeboxModal isOpen={isJukeboxOpen} onClose={() => setIsJukeboxOpen(false)} />
      <ProjectSidebar isOpen={isProjectOpen} onClose={() => setIsProjectOpen(false)} />

      {/* LEFT: Timeline */}
      {!isPlaying && (
        <div className="w-64 border-r border-zinc-800 p-4 flex flex-col bg-[#0a0a0c]">
          <div className="flex justify-between items-center mb-4">
            <button onClick={() => setIsProjectOpen(true)} className="p-1 text-zinc-500 hover:text-cyan-400 transition-colors">
              <Settings size={18} />
            </button>
            <h2 className="text-cyan-400 text-[12px] tracking-widest font-bold uppercase">Timeline</h2>
            <div className="flex gap-2">
              <button onClick={clearAllFrames} className="p-1 hover:text-red-500 opacity-40 hover:opacity-100"><Eraser size={14} /></button>
              <button onClick={duplicateFrame} className="p-1 hover:text-cyan-400"><Copy size={14} /></button>
              <button onClick={addFrame} className="p-1 hover:text-green-400"><Plus size={16} /></button>
            </div>
          </div>
          
          <button onClick={() => setIsJukeboxOpen(true)} className="mt-2 mb-6 w-full flex items-center justify-between p-3 border border-pink-900/30 bg-pink-950/10 hover:bg-pink-900/20 transition-all group">
            <div className="flex items-center gap-2">
              <Music size={14} className="text-pink-500" />
              <span className="text-[10px] font-bold text-pink-500 tracking-widest uppercase">Jukebox</span>
            </div>
            <span className="text-[9px] text-zinc-600">{playlist.filter(Boolean).length}/10</span>
          </button>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {frames.map((f, i) => (
              <div key={f.id} onClick={() => selectFrame(i)} className={`group relative flex items-center p-3 text-left text-xs border transition-all cursor-pointer ${currentIndex === i ? 'border-cyan-500 bg-cyan-900/10 text-cyan-400' : 'border-zinc-800 hover:border-zinc-700'}`}>
                <div className="flex-1 truncate">
                  <span className="opacity-50 block text-[9px] uppercase">Frame {i + 1}</span>
                  <span className="truncate block">{f.speaker.text || "..."}</span>
                </div>
                {frames.length > 1 && (
                  <button onClick={(e) => { e.stopPropagation(); deleteFrame(i); }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500"><Trash2 size={12} /></button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CENTER: Preview Area */}
      <div className={`flex-1 flex flex-col relative transition-all duration-500 ${isPlaying ? 'bg-black' : 'bg-zinc-950 p-8'}`}>
        {!isPlaying && (
          <div className="absolute top-6 left-6 z-20 flex flex-col items-start gap-2">
            <button 
              onClick={() => setIsCreatorOpen(true)}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-full text-xs font-bold transition-all transform hover:scale-105 active:scale-95"
            >
              <Activity size={14} /> CHARACTER LAB
            </button>
            <div className="text-[8px] text-zinc-700 uppercase tracking-widest ml-2">
              Laboratory Ready // BTC-7
            </div>
          </div>
        )}

        {/* TOP RIGHT: Start Button */}
        {!isPlaying && (
          <div className="absolute top-6 right-6 z-20 flex flex-col items-end gap-2">
            <button 
              onClick={() => setIsPlaying(true)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-full text-xs font-bold transition-all transform hover:scale-105 active:scale-95"
            >
              <Play size={14} fill="currentColor" /> START SCRIPT
            </button>
            <div className="text-[8px] text-zinc-700 uppercase tracking-widest mr-2">
              System Ready // BTC-7
            </div>
          </div>
        )}
        
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center pointer-events-none">
          {!isPlaying && (
            <div className="flex flex-col items-center">
              <h1 className="text-[10px] tracking-[0.4em] text-zinc-500 font-bold uppercase">Virtual Bar Interface</h1>
              <div className="h-[1px] w-48 bg-gradient-to-r from-transparent via-zinc-700 to-transparent mt-2"></div>
              <div className="mt-3 flex items-center gap-3">
                <span className="h-[1px] w-4 bg-zinc-800"></span>
                <p className="text-[9px] tracking-[0.2em] text-zinc-600 uppercase">Press <span className="text-zinc-400 font-bold">[ESC]</span> to abort sequence</p>
                <span className="h-[1px] w-4 bg-zinc-800"></span>
              </div>
            </div>
          )}
        </div>
        
        <div className={`flex-1 flex items-center justify-center ${isPlaying ? 'w-screen h-screen' : 'w-full h-full'}`}>
          <Preview />
        </div>

        {!isPlaying && (
          <div className="p-4 border-t border-zinc-900/50 flex justify-center gap-8 text-[9px] text-zinc-600 uppercase tracking-widest">
            <span>Frame: {currentIndex + 1} / {frames.length}</span>
          </div>
        )}
      </div>

      {/* RIGHT: Inspector */}
      {!isPlaying && (
        <div className="w-80 border-l border-zinc-800 flex flex-col bg-[#0a0a0c]">
          <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
             <h2 className="text-pink-500 text-xs tracking-widest font-bold uppercase">Inspector</h2>
             <button onClick={duplicateFrame} className="text-[10px] bg-zinc-800 px-2 py-1 rounded hover:bg-zinc-700 font-bold uppercase">Duplicate</button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <section className="space-y-3">
              <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-tighter">Dialogue Script</label>
              <div className="space-y-2">
                <select 
                  value={currentFrame.speaker.id} 
                  onChange={(e) => updateCurrentFrame({ speaker: { ...currentFrame.speaker, id: e.target.value }})} 
                  className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs outline-none focus:border-pink-500"
                >
                  <option value="">--- NO SPEAKER ---</option>
                  {validCharacterKeys.map(id => (<option key={id} value={id}>{(allCharacters as any)[id].displayName || id}</option>))}
                </select>
                <textarea value={currentFrame.speaker.text} onChange={(e) => updateCurrentFrame({ speaker: { ...currentFrame.speaker, text: e.target.value }})} className="w-full bg-zinc-900 border border-zinc-800 p-3 text-xs h-32 outline-none focus:border-pink-500 leading-relaxed resize-none" placeholder="Type dialogue..."/>
              </div>
            </section>

            <section className="space-y-4 pt-4 border-t border-zinc-900">
              <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-tighter">Stage Presence</label>
              
              {(['left', 'center', 'right'] as const).map((slot) => (
                <div key={slot} className="space-y-2 p-2 border border-zinc-800 rounded bg-zinc-900/10">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold">{slot} Slot</span>
                    <button onClick={() => addCharacterToSlot(slot)} className="text-[8px] text-cyan-500 hover:text-white uppercase font-bold">+ Add</button>
                  </div>

                  <div className="space-y-3">
                   {Array.isArray(currentFrame.characters[slot]) && 
                    currentFrame.characters[slot].map((char, index) => (
                      <div key={index} className="p-3 bg-zinc-900 border border-zinc-800 rounded-sm relative group/char">
                        {/* Character Selector */}
                        <select 
                          value={char.id} 
                          onChange={(e) => {
                            if (e.target.value === 'none') {
                              removeCharacterFromSlot(slot, index);
                            } else {
                              updateCharacterInSlot(slot, index, { id: e.target.value });
                            }
                          }}
                          className="w-full bg-black border border-zinc-800 p-1.5 text-xs text-zinc-300 mb-2"
                        >
                          {validCharacterKeys.map(id => <option key={id} value={id}>{(allCharacters as any)[id].displayName || id}</option>)}
                        </select>

                        {/* Pose and X-Offset */}
                        <div className="grid grid-cols-2 gap-2">
                          <select 
                            value={char.pose} 
                            onChange={(e) => updateCharacterInSlot(slot, index, { pose: e.target.value })}
                            className="bg-black border border-zinc-800 p-1 text-[10px] text-cyan-500"
                          >
                            {Object.keys((allCharacters as any)[char.id]?.poses || {}).map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                          
                          <input 
                            type="number" 
                            value={char.xOffset || 0} 
                            onChange={(e) => updateCharacterInSlot(slot, index, { xOffset: parseInt(e.target.value) || 0 })}
                            className="bg-black border border-zinc-800 p-1 text-[10px] text-zinc-400 font-mono"
                            placeholder="X Offset"
                          />
                        </div>

                        <button 
                          onClick={() => removeCharacterFromSlot(slot, index)}
                          className="absolute -top-2 -right-2 bg-red-900 text-white p-1 rounded-full opacity-0 group-hover/char:opacity-100 transition-opacity"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            <section className="space-y-3 pt-4 border-t border-zinc-900">
              <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-tighter">Environment</label>
              <select value={currentFrame.background} onChange={(e) => updateCurrentFrame({ background: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs outline-none focus:border-zinc-500">
                <option value="bar_night">Bar (Night)</option>
                <option value="black">Void</option>
              </select>
            </section>

            <section className="pt-10 pb-4 opacity-20 hover:opacity-100 transition-opacity duration-500">
              <div className="h-[1px] w-full bg-zinc-800 mb-4"></div>
              <p className="text-[8px] leading-relaxed text-zinc-500 uppercase tracking-tighter">
                VA-11 HALL-A: Cyberpunk Bartender Action and all respective characters, names, and assets are 
                Trademark & © of <span className="text-zinc-400">Sukeban Games</span>. 
              </p>
              <p className="text-[8px] leading-relaxed text-zinc-500 uppercase tracking-tighter mt-2">
                This is a <span className="text-pink-900 font-bold">non-commercial fan project</span>.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <div className="w-1 h-1 bg-zinc-700 rounded-full"></div>
                <span className="text-[7px] text-zinc-600 font-bold tracking-[0.2em]">BTC-7 // VER 1.0.4</span>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}