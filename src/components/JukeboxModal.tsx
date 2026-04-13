import { X, Music } from 'lucide-react';
import songData from '../engine/jsons/songs.json';
import { useScriptStore } from '../store/useScriptStore';
import { useState } from 'react';

export const JukeboxModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { playlist, setPlaylistSlot } = useScriptStore();
  const [selectedSlot, setSelectedSlot] = useState<number | null>(0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-10 font-mono">
      <div className="bg-[#0a0a0c] border border-zinc-800 w-full max-w-4xl h-[600px] flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/30">
          <div className="flex items-center gap-3">
            <Music className="text-pink-500" size={18} />
            <h2 className="text-zinc-100 text-xs tracking-[0.3em] font-bold uppercase">Btc Jukebox System</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left */}
          <div className="w-1/3 border-r border-zinc-800 p-6 space-y-2 overflow-y-auto">
            <h3 className="text-[10px] text-zinc-500 mb-4 tracking-widest uppercase">Target Playlist</h3>
            {playlist.map((songId, index) => {
              const song = songData.find(s => s.id === songId);
              return (
                <div 
                  key={index}
                  onClick={() => setSelectedSlot(index)}
                  className={`p-3 border cursor-pointer transition-all ${
                    selectedSlot === index 
                    ? 'border-pink-500 bg-pink-500/10' 
                    : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-600'
                  }`}
                >
                  <div className="text-[9px] text-zinc-600 mb-1">SLOT {String(index + 1).padStart(2, '0')}</div>
                  <div className={`text-xs truncate ${song ? 'text-cyan-400' : 'text-zinc-700 italic'}`}>
                    {song ? song.title : '--- EMPTY ---'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right */}
          <div className="flex-1 p-6 overflow-y-auto space-y-1">
            <h3 className="text-[10px] text-zinc-500 mb-4 tracking-widest uppercase">Music Library</h3>
            <button 
              onClick={() => selectedSlot !== null && setPlaylistSlot(selectedSlot, null)}
              className="w-full text-left p-3 text-xs text-red-900 border border-transparent hover:border-red-900/30 transition-all uppercase"
            >
              [ Clear Slot ]
            </button>
            {songData.map((song) => (
              <button
                key={song.id}
                onClick={() => selectedSlot !== null && setPlaylistSlot(selectedSlot, song.id)}
                className="w-full text-left p-3 text-xs border border-zinc-900 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all flex justify-between items-center group"
              >
                <span className="text-zinc-300 group-hover:text-white">{song.title}</span>
                <span className="text-[9px] text-zinc-600 uppercase">Select</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 text-center">
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest">
            Select a slot on the left, then choose a track from the library.
          </p>
        </div>
      </div>
    </div>
  );
};