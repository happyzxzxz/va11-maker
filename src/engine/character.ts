import { Sprite, Container, Texture, AnimatedSprite } from 'pixi.js';
import gsap from 'gsap';

export interface FaceOffsets {
    eyes: { x: number, y: number };
    mouth: { x: number, y: number };
    characterAnim?: { x: number, y: number };
}

export interface CharacterLayers {
    body: Texture | any;
    eyes: (Texture | any)[];
    mouth: (Texture | any)[];
    characterAnim: (Texture | any)[];
    staticCharAnim: Texture | any | null;
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

    private body: Sprite | any;
    private eyeAnim: AnimatedSprite | any | null = null;
    private mouthAnim: AnimatedSprite | any | null = null;
    private characterAnim: AnimatedSprite | any | null = null;
    private staticCharAnim: Sprite | any | null = null;
    private animIntervalTimeout: number | null = null;
    private currentAnimInterval: { min: number, max: number } | null = null;
    private blinkTimeout: number | null = null;

    constructor(characterKey: string, layers: CharacterLayers, offsets: FaceOffsets, options: CharacterOptions) {
        this.characterKey = characterKey;
        this.view = new Container();
        
        this.body = layers.body.clone ? layers.body.clone() : new Sprite(layers.body);
        this.view.addChild(this.body);

        // 1. Blinking Logic
        if (layers.eyes && layers.eyes.length > 0) {
            if (layers.eyes[0].clone) {
                this.eyeAnim = layers.eyes[0].clone();
                this.eyeAnim.loop = false;
            } else {
                this.eyeAnim = new AnimatedSprite(layers.eyes);
                this.eyeAnim.animationSpeed = 0.15;
                this.eyeAnim.loop = false;
            }
            this.eyeAnim.x = offsets.eyes.x;
            this.eyeAnim.y = offsets.eyes.y;
            this.eyeAnim.visible = false;
            this.eyeAnim.onComplete = () => { if (this.eyeAnim) this.eyeAnim.visible = false; };
            this.view.addChild(this.eyeAnim);
            this.startBlinkingLoop();
        }

        // 2. Mouth Logic
        if (layers.mouth && layers.mouth.length > 0) {
            if (layers.mouth[0].clone) {
                this.mouthAnim = layers.mouth[0].clone();
                this.mouthAnim.loop = true;
            } else {
                this.mouthAnim = new AnimatedSprite(layers.mouth);
                this.mouthAnim.animationSpeed = 0.1;
                this.mouthAnim.loop = true;
            }
            this.mouthAnim.x = offsets.mouth.x;
            this.mouthAnim.y = offsets.mouth.y;
            this.mouthAnim.visible = false;
            this.view.addChild(this.mouthAnim);
        }

        // 3. Character Animation Logic
        if (layers.characterAnim && layers.characterAnim.length > 0) {
            if (layers.staticCharAnim) {
                this.staticCharAnim = layers.staticCharAnim.clone ? layers.staticCharAnim.clone() : new Sprite(layers.staticCharAnim);
                this.staticCharAnim.x = offsets.characterAnim?.x || 0;
                this.staticCharAnim.y = offsets.characterAnim?.y || 0;
                this.view.addChild(this.staticCharAnim);
            }

            if (layers.characterAnim[0].clone) {
                this.characterAnim = layers.characterAnim[0].clone();
            } else {
                this.characterAnim = new AnimatedSprite(layers.characterAnim);
                this.characterAnim.animationSpeed = options.animSpeed || 0.05;
            }
            
            this.characterAnim.x = offsets.characterAnim?.x || 0;
            this.characterAnim.y = offsets.characterAnim?.y || 0;
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
                if ('play' in this.characterAnim) this.characterAnim.play();
                if (this.staticCharAnim) this.staticCharAnim.visible = false;
            }
        }

        const w = this.body.texture ? this.body.texture.width : this.body.width;
        const h = this.body.texture ? this.body.texture.height : this.body.height;
        this.view.pivot.set(w / 2, h);
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
                if (this.characterAnim.gotoAndPlay) {
                    this.characterAnim.gotoAndPlay(0);
                } else {
                    if ('currentFrame' in this.characterAnim) this.characterAnim.currentFrame = 0;
                    this.characterAnim.play();
                }
            }
        }, delay);
    }

    public updatePose(layers: CharacterLayers, offsets: FaceOffsets, options: CharacterOptions) {
        if (this.body) {
            this.view.removeChild(this.body);
            this.body.destroy({ children: true, texture: false });
        }
        this.body = layers.body.clone ? layers.body.clone() : new Sprite(layers.body);
        this.view.addChildAt(this.body, 0);

        const w = this.body.texture ? this.body.texture.width : this.body.width;
        const h = this.body.texture ? this.body.texture.height : this.body.height;
        this.view.pivot.set(w / 2, h);

        if (this.animIntervalTimeout) {
            window.clearTimeout(this.animIntervalTimeout);
            this.animIntervalTimeout = null;
        }

        if (this.blinkTimeout) {
            window.clearTimeout(this.blinkTimeout);
            this.blinkTimeout = null;
        }

        if (this.eyeAnim) {
            this.view.removeChild(this.eyeAnim);
            this.eyeAnim.destroy({ children: true, texture: false });
            this.eyeAnim = null;
        }

        if (layers.eyes && layers.eyes.length > 0) {
            if (layers.eyes[0].clone) {
                this.eyeAnim = layers.eyes[0].clone();
                this.eyeAnim.loop = false;
            } else {
                this.eyeAnim = new AnimatedSprite(layers.eyes);
                this.eyeAnim.animationSpeed = 0.15;
                this.eyeAnim.loop = false;
            }
            this.eyeAnim.x = offsets.eyes.x;
            this.eyeAnim.y = offsets.eyes.y;
            this.eyeAnim.visible = false;
            this.eyeAnim.onComplete = () => { if (this.eyeAnim) this.eyeAnim.visible = false; };
            this.view.addChild(this.eyeAnim);
            this.startBlinkingLoop();
        }

        if (this.mouthAnim) {
            this.view.removeChild(this.mouthAnim);
            this.mouthAnim.destroy({ children: true, texture: false });
            this.mouthAnim = null;
        }

        if (layers.mouth && layers.mouth.length > 0) {
            if (layers.mouth[0].clone) {
                this.mouthAnim = layers.mouth[0].clone();
                this.mouthAnim.loop = true;
            } else {
                this.mouthAnim = new AnimatedSprite(layers.mouth);
                this.mouthAnim.animationSpeed = 0.1;
                this.mouthAnim.loop = true;
            }
            this.mouthAnim.x = offsets.mouth.x;
            this.mouthAnim.y = offsets.mouth.y;
            this.mouthAnim.visible = false;
            this.view.addChild(this.mouthAnim);
        }

        if (this.staticCharAnim) {
            this.view.removeChild(this.staticCharAnim);
            this.staticCharAnim.destroy({ children: true, texture: false });
            this.staticCharAnim = null;
        }

        if (this.characterAnim) {
            if ('stop' in this.characterAnim) this.characterAnim.stop();
            this.view.removeChild(this.characterAnim);
            this.characterAnim.destroy({ children: true, texture: false });
            this.characterAnim = null;
        }

        if (layers.characterAnim && layers.characterAnim.length > 0) {
            if (layers.staticCharAnim) {
                this.staticCharAnim = layers.staticCharAnim.clone ? layers.staticCharAnim.clone() : new Sprite(layers.staticCharAnim);
                this.staticCharAnim.x = offsets.characterAnim?.x || 0;
                this.staticCharAnim.y = offsets.characterAnim?.y || 0;
                this.view.addChildAt(this.staticCharAnim, 1);
            }

            if (layers.characterAnim[0].clone) {
                this.characterAnim = layers.characterAnim[0].clone();
            } else {
                this.characterAnim = new AnimatedSprite(layers.characterAnim);
                this.characterAnim.animationSpeed = options.animSpeed || 0.05;
            }

            this.characterAnim.x = offsets.characterAnim?.x || 0;
            this.characterAnim.y = offsets.characterAnim?.y || 0;
            this.view.addChild(this.characterAnim);

            if (options.animInterval) {
                this.currentAnimInterval = options.animInterval;
                this.characterAnim.loop = false;
                this.characterAnim.visible = false;
                
                this.characterAnim.onComplete = () => {
                    if (this.characterAnim) this.characterAnim.visible = false;
                    if (this.staticCharAnim && layers.staticCharAnim) this.staticCharAnim.visible = true;
                    this.scheduleNextAnim();
                };

                if (this.staticCharAnim) this.staticCharAnim.visible = true;
                this.scheduleNextAnim();
            } else {
                this.currentAnimInterval = null;
                this.characterAnim.loop = true;
                this.characterAnim.visible = true;
                if ('play' in this.characterAnim) this.characterAnim.play();
                if (this.staticCharAnim) this.staticCharAnim.visible = false;
            }
        } 
        
        this.view.scale.set(options.scale);
    }

    private startBlinkingLoop() {
        if (!this.eyeAnim) return;

        const eye = this.eyeAnim; 
        
        const nextBlink = Math.random() * 8000 + 2000;
        this.blinkTimeout = window.setTimeout(() => {
            eye.visible = true;
            if (eye.gotoAndPlay) {
                eye.gotoAndPlay(0);
            } else {
                if ('currentFrame' in eye) eye.currentFrame = 0;
                eye.play();
            }
            this.startBlinkingLoop();
        }, nextBlink);
    }

    public setTalking(talking: boolean) {
        if (!this.mouthAnim) return;

        if (talking) {
            this.mouthAnim.visible = true;
            if ('play' in this.mouthAnim) this.mouthAnim.play();
        } else {
            if (this.mouthAnim.gotoAndStop) {
                this.mouthAnim.gotoAndStop(0);
            } else {
                if ('stop' in this.mouthAnim) this.mouthAnim.stop();
                if ('currentFrame' in this.mouthAnim) this.mouthAnim.currentFrame = 0;
            }
            this.mouthAnim.visible = false;
        }
    }


    public destroy() {
        if (this.blinkTimeout) window.clearTimeout(this.blinkTimeout);
        if (this.animIntervalTimeout) window.clearTimeout(this.animIntervalTimeout); 
        gsap.killTweensOf(this.view);
        this.view.destroy({ children: true });
    }
}