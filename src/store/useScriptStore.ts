import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT_FRAME = {
  background: 'bar_night',
  characters: {
    left: null,
    center: null,
    right: null
  },
  speaker: {
    id: '',
    text: '',
    mouthTarget: null
  }
};

export interface Frame {
  id: string;
  background: string;
  characters: {
    left: { id: string; pose: string } | null;
    center: { id: string; pose: string } | null;
    right: { id: string; pose: string } | null;
  };
  speaker: { id: string; text: string; mouthTarget: string | null };
}

interface ScriptState {
  frames: Frame[];
  currentIndex: number;
  addFrame: () => void;
  updateCurrentFrame: (data: Partial<Frame>) => void;
  selectFrame: (index: number) => void;
  duplicateFrame: () => void;
  deleteFrame: (index: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  clearAllFrames: () => void;
  playlist: (string | null)[];
  setPlaylistSlot: (index: number, songId: string | null) => void;
  loadExternalScript: (data: { frames: any[], playlist: (string | null)[] }) => void;
  renderer: any | null;
  setRenderer: (renderer: any) => void;
  customCharacters: Record<string, any>;
  addCustomCharacter: (charData: any) => void;
  deleteCustomCharacter: (id: string) => void;
}

export const useScriptStore = create<ScriptState>()(
  persist(
    (set) => ({
      frames: [{ ...DEFAULT_FRAME, id: '1' }],
      currentIndex: 0,
      isPlaying: false,
      renderer: null,
      setRenderer: (r) => set({ renderer: r }),
      customCharacters: {}, 

      addFrame: () => set((state) => {
        const newFrame = { ...DEFAULT_FRAME, id: Math.random().toString(36).substr(2, 9) };
        const newFrames = [...state.frames];
        newFrames.splice(state.currentIndex + 1, 0, newFrame);
        return { frames: newFrames, currentIndex: state.currentIndex + 1 };
      }),

      loadExternalScript: (data) => set((state) => {
        if (!data || !Array.isArray(data.frames)) {
            alert("Invalid project file: Frames array not found.");
            return state;
        }

        if (state.renderer) {
          state.renderer.stopMusic();
        }

        return {
            frames: data.frames,
            playlist: data.playlist || Array(10).fill(null),
            currentIndex: 0,
            isPlaying: false
        };
    }),

      playlist: Array(10).fill(null),
      setPlaylistSlot: (index, songId) => set((state) => {
          const newPlaylist = [...state.playlist];
          newPlaylist[index] = songId;
          return { playlist: newPlaylist };
      }),

      addCustomCharacter: (charData) => set((state) => ({
          customCharacters: { 
            ...state.customCharacters, 
            [charData.id]: charData 
          }
      })),
      deleteCustomCharacter: (id) => set((state) => {
        const newCustom = { ...state.customCharacters };
        delete newCustom[id];
        return { customCharacters: newCustom };
    }),

      duplicateFrame: () => set((state) => {
        const currentFrame = state.frames[state.currentIndex];
        const newFrame = { ...JSON.parse(JSON.stringify(currentFrame)), id: Math.random().toString(36).substr(2, 9) };
        const newFrames = [...state.frames];
        newFrames.splice(state.currentIndex + 1, 0, newFrame);
        return { frames: newFrames, currentIndex: state.currentIndex + 1 };
      }),

      deleteFrame: (index: number) => set((state) => {
        if (state.frames.length <= 1) return state;
        const newFrames = state.frames.filter((_, i) => i !== index);
        const nextIndex = state.currentIndex >= index ? Math.max(0, state.currentIndex - 1) : state.currentIndex;
        return { frames: newFrames, currentIndex: nextIndex };
      }),

      selectFrame: (index) => set({ currentIndex: index }),

      updateCurrentFrame: (data) => set((state) => {
        const newFrames = [...state.frames];
        newFrames[state.currentIndex] = { ...newFrames[state.currentIndex], ...data };
        return { frames: newFrames };
      }),

      setIsPlaying: (playing) => set({ isPlaying: playing }),

      clearAllFrames: () => {
        if (window.confirm("CRITICAL WARNING: This will permanently delete your entire script. Proceed?")) {
          set({
            frames: [{ ...DEFAULT_FRAME, id: Date.now().toString() }],
            currentIndex: 0
          });
        }
      }
    }),
    
    {
      name: 'va11-maker-storage',
      partialize: (state) => ({
        frames: state.frames,
        playlist: state.playlist,
        currentIndex: state.currentIndex,
        customCharacters: state.customCharacters, 
      }),
    }
  )
);