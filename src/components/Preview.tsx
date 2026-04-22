import { useEffect, useRef, useState } from 'react';
import { SceneRenderer } from '../engine/sceneRenderer';
import { useScriptStore } from '../store/useScriptStore';
import { ScriptPlayer } from '../engine/ScriptPlayer';
import { GameController } from '../engine/gameController';
import { getCharacterEntry } from '../engine/utils/characterLookup';

export const Preview = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<SceneRenderer | null>(null);
  const[loaded, setLoaded] = useState(false);
  const { frames, currentIndex, isPlaying, setIsPlaying, playlist, setRenderer, customCharacters } = useScriptStore();

  useEffect(() => {
    let isMounted = true;
    let rendererInstance: SceneRenderer | null = null;
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

        rendererInstance = r;
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

    return () => {
        isMounted = false;
        setLoaded(false);

        if (observer) observer.disconnect();
        if (rendererInstance) rendererInstance.destroy();
        
        rendererRef.current = null;
        setRenderer(null);

        if (containerRef.current) {
            containerRef.current.innerHTML = '';
        }
    };
  },[]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !loaded) return;

    if (!isPlaying) {
      renderer.stopMusic();

      const frame = frames[currentIndex];
      const speakerProfile = getCharacterEntry(frame.speaker.id);
      
      renderer.setBackground(frame.background);
      renderer.updateCharacters(frame.characters);
      renderer.setDialogueInstant(
        frame.speaker.text,
        speakerProfile?.displayName || frame.speaker.id,
        speakerProfile?.nameColor || "0xFFFFFF"
      );
    }

    if (isPlaying) {
      const activeSongs = playlist.filter((id): id is string => id !== null);
      renderer.startPlaylist(activeSongs);

      const player = new ScriptPlayer(renderer, frames);
      const controller = new GameController(renderer, player);

      renderer.populateLoadMenu(frames.length);

      player.startFrom(currentIndex); 

      renderer.onExitRequest = () => {
        setIsPlaying(false);
      };

      renderer.onJumpRequest = (index: number) => {
        player.jumpToFrame(index);
      };

      return () => {
        controller.destroy();
      };
    }
    else {
      renderer.stopMusic();
    }
  },[frames, currentIndex, loaded, isPlaying, playlist, setIsPlaying, customCharacters]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsPlaying(false);
    };
    
    if (isPlaying) {
      window.addEventListener('keydown', handleEsc);
    }
    
    return () => window.removeEventListener('keydown', handleEsc);
  },[isPlaying, setIsPlaying]);

  return (
    <div className={`relative bg-black flex items-center justify-center transition-all duration-500 ${
      isPlaying ? 'w-screen h-screen' : 'aspect-video w-full max-w-[900px] border border-zinc-800'
    }`}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-[10px] tracking-widest">
          CONNECTING TO BTC-7...
        </div>
      )}
      
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};