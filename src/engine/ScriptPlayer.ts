import { SceneRenderer } from "./sceneRenderer";
import { getCharacterEntry } from './utils/characterLookup';

export class ScriptPlayer {
    private renderer: SceneRenderer;
    private frames: any[];
    private currentFrameIndex: number = -1;
    private isBusyRendering: boolean = false;

    public onComplete?: () => void; 

    constructor(renderer: SceneRenderer, script: any[]) {
        this.renderer = renderer;
        this.frames = script;
    }

    public async next() {
        if (this.isBusyRendering) return;

        this.currentFrameIndex++;
        if (this.currentFrameIndex >= this.frames.length) {
            if (this.onComplete) this.onComplete();
            return;
        }

        this.isBusyRendering = true;
        const frame = this.frames[this.currentFrameIndex];
        await this.renderFrame(frame);
        this.isBusyRendering = false;
    }


    private async renderFrame(frame: any) {
        const speakerId = frame.speaker.id;
        const speakerProfile = getCharacterEntry(speakerId);

        let voiceAlias = '';
        if (speakerProfile?.speechFile) {
            voiceAlias = speakerProfile.speechFile;
        };

        const displayName = speakerProfile?.displayName || speakerId || "???";
        const nameColor = speakerProfile?.nameColor || "0xFFFFFF";

        this.renderer.prepareForNewFrame(
            frame.speaker.text, 
            displayName, 
            nameColor, 
            voiceAlias
        );

        if (frame.background) await this.renderer.setBackground(frame.background);
        await this.renderer.updateCharacters(frame.characters);

        this.renderer.typeWrite(speakerId);
    }

    public async playForRecording(onFrameFinish: () => void) {
        this.currentFrameIndex = 0;
        
        const playCurrentIndex = async () => {
            if (this.currentFrameIndex >= this.frames.length) {
                setTimeout(onFrameFinish, 750); 
                return;
            }

            const frame = this.frames[this.currentFrameIndex];
            await this.renderFrame(frame);

            const checkDone = setInterval(() => {
                if (!this.renderer.getBusy()) {
                    clearInterval(checkDone);
                    
                    this.currentFrameIndex++;
                    
                    setTimeout(playCurrentIndex, 600); 
                }
            }, 100);
        };

        playCurrentIndex();
    }

    public jumpToFrame(index: number) {
        this.currentFrameIndex = Math.max(0, Math.min(index, this.frames.length - 1));
        const frame = this.frames[this.currentFrameIndex];
        this.renderFrame(frame);
    }

    public async startFrom(index: number) {
        this.currentFrameIndex = index - 1;
        await this.next();
    }
}