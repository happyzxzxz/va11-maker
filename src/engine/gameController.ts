import { SceneRenderer } from "./sceneRenderer";
import { ScriptPlayer } from "./ScriptPlayer";

export class GameController {
    private renderer: SceneRenderer;
    private player: ScriptPlayer;
    private handleKeyDownBound: (e: KeyboardEvent) => void;

    constructor(renderer: SceneRenderer, player: ScriptPlayer) {
        this.renderer = renderer;
        this.player = player;
        
        this.handleKeyDownBound = this.handleKeyDown.bind(this);
        this.initListeners();
    }

    private initListeners() {
        const clickArea = this.renderer.dialogueClickArea;
        if (clickArea) {
            clickArea.on('pointerdown', this.handlePointerDown, this);
        }

        window.addEventListener('keydown', this.handleKeyDownBound);
    }

    private handlePointerDown(e: any) {
        e.stopPropagation();
        this.handleInteraction();
    }

    private handleKeyDown(e: KeyboardEvent) {
        if (e.code === 'Space') {
            e.preventDefault(); 
            this.handleInteraction();
        }
    }

    private handleInteraction() {
        if (this.renderer.getBusy()) {
            this.renderer.finishTyping();
        } else {
            this.player.next();
        }
    }

    public destroy() {
        window.removeEventListener('keydown', this.handleKeyDownBound);
        
        const clickArea = this.renderer.dialogueClickArea;
        if (clickArea) {
            clickArea.off('pointerdown', this.handlePointerDown, this);
        }
        console.log("GameController destroyed, listeners removed.");
    }
}