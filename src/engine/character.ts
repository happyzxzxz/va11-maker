import { Sprite, Container, Texture, AnimatedSprite } from 'pixi.js';
import gsap from 'gsap';

export interface FaceOffsets {
    eyes: { x: number, y: number };
    mouth: { x: number, y: number };
    characterAnim?: { x: number, y: number };
}

export interface CharacterLayers {
    body: Texture;
    eyes: Texture[];
    mouth: Texture[];
    characterAnim: Texture[];
    staticCharAnim: Texture | null;
}

export interface CharacterOptions {
    x: number;
    scale: number;
    animSpeed?: number;
    animInterval?: { min: number; max: number };
}

export class Character {
    public view: Container;
    public characterKey: string;

    private body: Sprite;
    private eyeAnim: AnimatedSprite | null = null;
    private mouthAnim: AnimatedSprite | null = null;
    private characterAnim: AnimatedSprite | null = null;
    private staticCharAnim: Sprite | null = null;
    private animIntervalTimeout: number | null = null;
    private currentAnimInterval: { min: number, max: number } | null = null;
    private blinkTimeout: number | null = null;

    constructor(characterKey: string, layers: CharacterLayers, offsets: FaceOffsets, options: CharacterOptions) {
        this.characterKey = characterKey;
        this.view = new Container();
        this.body = new Sprite(layers.body);
        this.view.addChild(this.body);

        // 1. Blinking Logic
        if (layers.eyes && layers.eyes.length > 0) {
            this.eyeAnim = new AnimatedSprite(layers.eyes);
            this.eyeAnim.x = offsets.eyes.x;
            this.eyeAnim.y = offsets.eyes.y;
            this.eyeAnim.animationSpeed = 0.15;
            this.eyeAnim.loop = false;
            this.eyeAnim.visible = false;
            this.eyeAnim.onComplete = () => { if (this.eyeAnim) this.eyeAnim.visible = false; };
            this.view.addChild(this.eyeAnim);
            this.startBlinkingLoop();
        }

        // 2. Mouth Logic
        if (layers.mouth && layers.mouth.length > 0) {
            this.mouthAnim = new AnimatedSprite(layers.mouth);
            this.mouthAnim.x = offsets.mouth.x;
            this.mouthAnim.y = offsets.mouth.y;
            this.mouthAnim.animationSpeed = 0.1;
            this.mouthAnim.loop = true; // Ensure talking loops
            this.mouthAnim.visible = false;
            this.view.addChild(this.mouthAnim);
        }

        // 3. Character Animation Logic
        if (layers.characterAnim && layers.characterAnim.length > 0) {

            if (layers.staticCharAnim) {
                this.staticCharAnim = new Sprite(layers.staticCharAnim);
                this.staticCharAnim.x = offsets.characterAnim?.x || 0;
                this.staticCharAnim.y = offsets.characterAnim?.y || 0;
                this.view.addChild(this.staticCharAnim);
            }

            this.characterAnim = new AnimatedSprite(layers.characterAnim);
            this.characterAnim.x = offsets.characterAnim?.x || 0;
            this.characterAnim.y = offsets.characterAnim?.y || 0;
            this.characterAnim.animationSpeed = options.animSpeed || 0.05;
            this.view.addChild(this.characterAnim);

            if (options.animInterval) {
                this.currentAnimInterval = options.animInterval;
                this.characterAnim.loop = false;
                this.characterAnim.visible = false;
                
                this.characterAnim.onComplete = () => {
                    this.characterAnim!.visible = false;
                    if (this.staticCharAnim) this.staticCharAnim.visible = true;
                    this.scheduleNextAnim();
                };
                this.scheduleNextAnim();
            } else {

                this.characterAnim.loop = true;
                this.characterAnim.visible = true;
                this.characterAnim.play();
                if (this.staticCharAnim) this.staticCharAnim.visible = false;
            }
        }

        this.view.pivot.set(this.body.width / 2, this.body.height);
        this.view.x = options.x;
        this.view.y = 573; 
        this.view.scale.set(options.scale);
    }


    private scheduleNextAnim() {
        if (!this.characterAnim || !this.currentAnimInterval) return;

        const delay = Math.random() * (this.currentAnimInterval.max - this.currentAnimInterval.min) + this.currentAnimInterval.min;

        this.animIntervalTimeout = window.setTimeout(() => {
            if (this.characterAnim) {
                if (this.staticCharAnim) this.staticCharAnim.visible = false;
                this.characterAnim.visible = true;
                this.characterAnim.gotoAndPlay(0);
            }
        }, delay);
    }

    public updatePose(layers: CharacterLayers, offsets: FaceOffsets, options: CharacterOptions) {
        this.body.texture = layers.body;

        if (this.animIntervalTimeout) {
            window.clearTimeout(this.animIntervalTimeout);
            this.animIntervalTimeout = null;
        }

        if (this.eyeAnim) {
            if (layers.eyes && layers.eyes.length > 0) {
                this.eyeAnim.textures = layers.eyes;
                this.eyeAnim.x = offsets.eyes.x;
                this.eyeAnim.y = offsets.eyes.y;
                this.eyeAnim.visible = false;
            } else {
                this.eyeAnim.visible = false;
            }
        }

        if (this.mouthAnim) {
            if (layers.mouth && layers.mouth.length > 0) {
                this.mouthAnim.textures = layers.mouth;
                this.mouthAnim.x = offsets.mouth.x;
                this.mouthAnim.y = offsets.mouth.y;
            } else {
                this.mouthAnim.visible = false;
            }
        }

        if (this.characterAnim) {
            if (layers.characterAnim && layers.characterAnim.length > 0) {
                this.characterAnim.textures = layers.characterAnim;
                this.characterAnim.x = offsets.characterAnim?.x || 0;
                this.characterAnim.y = offsets.characterAnim?.y || 0;
                this.characterAnim.animationSpeed = options.animSpeed || 0.05;

                if (this.staticCharAnim && layers.staticCharAnim) {
                    this.staticCharAnim.texture = layers.staticCharAnim;
                    this.staticCharAnim.x = offsets.characterAnim?.x || 0;
                    this.staticCharAnim.y = offsets.characterAnim?.y || 0;
                }

                if (options.animInterval) {
                    this.currentAnimInterval = options.animInterval;
                    this.characterAnim.loop = false;
                    this.characterAnim.visible = false;
                    if (this.staticCharAnim) this.staticCharAnim.visible = true;
                    this.scheduleNextAnim();
                } else {
                    this.currentAnimInterval = null;
                    this.characterAnim.loop = true;
                    this.characterAnim.visible = true;
                    this.characterAnim.play();
                    if (this.staticCharAnim) this.staticCharAnim.visible = false;
                }
            } else {
                this.characterAnim.stop();
                this.characterAnim.visible = false;
                if (this.staticCharAnim) this.staticCharAnim.visible = false;
            }
        }
    }

    private startBlinkingLoop() {
        if (!this.eyeAnim) return;
        
        const nextBlink = Math.random() * 8000 + 2000;
        this.blinkTimeout = window.setTimeout(() => {
            this.eyeAnim.visible = true;
            this.eyeAnim.gotoAndPlay(0);
            this.startBlinkingLoop();
        }, nextBlink);
    }

    public setTalking(talking: boolean) {
        if (!this.mouthAnim) return;

        if (talking) {
            this.mouthAnim.visible = true;
            this.mouthAnim.play();
        } else {
            this.mouthAnim.gotoAndStop(0);
            this.mouthAnim.visible = false;
        }
    }


    public destroy() {
        if (this.blinkTimeout) window.clearTimeout(this.blinkTimeout);
        if (this.animIntervalTimeout) window.clearTimeout(this.animIntervalTimeout); // CLEANUP
        gsap.killTweensOf(this.view);
        this.view.destroy({ children: true });
    }
}