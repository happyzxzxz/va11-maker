import { X, Download, Upload, Save, FileJson, Video } from 'lucide-react';
import { useScriptStore } from '../store/useScriptStore';
import { useRef, useState } from 'react';
import { ScriptPlayer } from '../engine/ScriptPlayer';
import { VideoRecorder } from '../engine/utils/VideoRecorder';

export const ProjectSidebar = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { frames, playlist, loadExternalScript, renderer, setIsPlaying } = useScriptStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);

  const handleExport = () => {
    const projectData = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      frames: frames,
      playlist: playlist
    };
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `valhalla_project.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportVideo = async () => {
      if (!renderer) return;

      setIsPlaying(true);
      setIsRecording(true);
      onClose();

      await new Promise(r => setTimeout(r, 500));
      renderer.resize(1366, 768);

      const audioStream = renderer.getAudioStream();
      const recorder = new VideoRecorder(renderer.app!.canvas, audioStream);
      recorder.start();
      renderer.kickstartAudio();

      const player = new ScriptPlayer(renderer, frames);
      
      const activeSongs = playlist.filter(id => id !== null) as string[];
      renderer.startPlaylist(activeSongs);

      await player.playForRecording(async () => {
          const videoBlob = await recorder.stop();
          renderer.stopMusic();
          
          renderer.resize(window.innerWidth, window.innerHeight);
          setIsPlaying(false);
          setIsRecording(false);

          const url = URL.createObjectURL(videoBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `valhalla_export_${Date.now()}.webm`;
          a.click();
      });
  };

  const handleImportClick = () => {
    // Trigger the hidden file input
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        
        if (window.confirm("Importing will overwrite your current progress. Continue?")) {
          loadExternalScript(json);
          onClose();
        }
      } catch (err) {
        alert("Error parsing JSON: The file appears to be corrupted or invalid.");
      }
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150]" onClick={onClose} />}

      <div className={`fixed top-0 left-0 h-full w-80 bg-[#0a0a0c] border-r border-zinc-800 z-[160] transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="p-6 border-b border-zinc-900 flex justify-between items-center bg-zinc-900/20">
          <div className="flex items-center gap-2 text-cyan-500 font-bold uppercase tracking-widest text-xs">
            <Save size={16} /> Project Manager
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Hidden input */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".json" 
            className="hidden" 
          />

          <h3 className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Local Files</h3>
          
          <button 
            onClick={handleExport}
            className="w-full group flex items-center gap-4 p-4 border border-zinc-800 bg-zinc-900/30 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all text-left"
          >
            <div className="p-2 bg-zinc-800 rounded group-hover:bg-cyan-500/20"><Download size={18} className="text-zinc-400 group-hover:text-cyan-400" /></div>
            <div>
              <div className="text-xs font-bold text-zinc-200">Export Script</div>
              <div className="text-[9px] text-zinc-600 uppercase">Save to local machine</div>
            </div>
          </button>

          {/* Import button */}
          <button 
            onClick={handleImportClick}
            className="w-full group flex items-center gap-4 p-4 border border-zinc-800 bg-zinc-900/30 hover:border-green-500/50 hover:bg-green-500/5 transition-all text-left"
          >
            <div className="p-2 bg-zinc-800 rounded group-hover:bg-green-500/20"><Upload size={18} className="text-zinc-400 group-hover:text-green-400" /></div>
            <div>
              <div className="text-xs font-bold text-zinc-200">Import Script</div>
              <div className="text-[9px] text-zinc-600 uppercase">Load existing project</div>
            </div>
          </button>

          <button 
            onClick={handleExportVideo}
            disabled={isRecording}
            className="w-full group flex items-center gap-4 p-4 border border-zinc-800 bg-zinc-900/30 hover:border-pink-500/50"
          >
            <Video size={18} className="text-pink-500" />
            <div className="text-left">
              <div className="text-xs font-bold text-zinc-200">
                  {isRecording ? 'Rendering...' : 'Export Video'}
              </div>
              <div className="text-[9px] text-zinc-600 uppercase">.WEBM Format</div>
            </div>
          </button>

          {/* Metadata & Footer */}
          <div className="pt-6 border-t border-zinc-900">
             <div className="text-[9px] text-zinc-600 uppercase">Current Session Info</div>
             <div className="mt-2 text-[10px] flex justify-between">
                <span className="text-zinc-500">Active Frames</span>
                <span className="text-zinc-300 font-mono">{frames.length}</span>
             </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent">
        <div className="space-y-3 opacity-40">
          <p className="text-[7px] text-zinc-500 uppercase leading-tight tracking-tight">
            Fan-made content generator. No official affiliation with Sukeban Games. 
            Please support the official release of VA-11 HALL-A.
          </p>
          <div className="flex items-center gap-2 grayscale brightness-50">
            <FileJson size={10} />
            <span className="text-[7px] uppercase tracking-widest font-bold">BTC-7</span>
          </div>
        </div>
      </div>

      </div>
    </>
  );
};