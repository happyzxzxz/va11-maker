import { useEffect, useRef, useState } from 'react';
import { SceneRenderer } from '../engine/sceneRenderer';
import { useScriptStore } from '../store/useScriptStore';
import characterData from '../engine/jsons/characters.json';
import { ScriptPlayer } from '../engine/ScriptPlayer';
import { GameController } from '../engine/gameController';

export const Preview = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<SceneRenderer | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { frames, currentIndex, isPlaying, setIsPlaying, playlist, setRenderer } = useScriptStore();

  useEffect(() => {
    let isMounted = true;
    let renderer: SceneRenderer | null = null;
    let observer: ResizeObserver | null = null;

    const setup = async () => {
        const r = new SceneRenderer(1366, 768);
        await r.init();
        
        if (!isMounted || !containerRef.current) {
            r.destroy();
            return;
        }

        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(r.app!.canvas);

        renderer = r;
        rendererRef.current = r;
        setRenderer(r);
        setLoaded(true);

        observer = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            r.resize(width, height);
        });
        
        observer.observe(containerRef.current);
    };

    setup();

    const player = new ScriptPlayer(rendererRef.current, frames);
    const controller = new GameController(rendererRef.current, player);

    return () => {
        isMounted = false;
        setLoaded(false);

        if (observer) observer.disconnect();
        if (renderer) renderer.destroy();
        if (controller) controller.destroy();
        rendererRef.current = null;
        setRenderer(null);

        if (containerRef.current) {
            containerRef.current.innerHTML = '';
        }
    };
}, []);


  useEffect(() => {
    // 1. If we are NOT playing, use the Editor logic (Instant updates)
    if (!isPlaying && rendererRef.current && loaded) {
      rendererRef.current.stopMusic();

      const frame = frames[currentIndex];
      const speakerProfile = (characterData as any)[frame.speaker.id];
      
      rendererRef.current.setBackground(frame.background);
      rendererRef.current.updateCharacters(frame.characters);
      rendererRef.current.setDialogueInstant(
        frame.speaker.text,
        speakerProfile?.displayName || frame.speaker.id,
        speakerProfile?.nameColor || "0xFFFFFF"
      );
    }

    // 2. If we ARE playing, we let ScriptPlayer take the wheel
    if (isPlaying && rendererRef.current && loaded) {

      const activeSongs = playlist.filter((id): id is string => id !== null);
      rendererRef.current.startPlaylist(activeSongs);

      const player = new ScriptPlayer(rendererRef.current, frames);
      const controller = new GameController(rendererRef.current, player);

      rendererRef.current.populateLoadMenu(frames.length);

      player.startFrom(currentIndex); 

      rendererRef.current.onExitRequest = () => {
        setIsPlaying(false);
      };

      rendererRef.current.onJumpRequest = (index: number) => {
        player.jumpToFrame(index);
      };

      return () => {
        if (controller) controller.destroy();
      };
    }
  }, [frames, currentIndex, loaded, isPlaying]);

  useEffect(() => {
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setIsPlaying(false);
  };
  
  if (isPlaying) {
    window.addEventListener('keydown', handleEsc);
  }
  
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isPlaying]);

  return (
    <div className={`relative bg-black flex items-center justify-center ${
    isPlaying ? 'w-screen h-screen' : 'aspect-video w-full max-w-[900px] border border-zinc-800'
  }`}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-[10px] tracking-widest">
          LOADING...
        </div>
      )}
      
      {/* The Pixi Container */}
      <div ref={containerRef} className="w-full h-full" />
      
    </div>
  );
};