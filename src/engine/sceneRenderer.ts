import { Application, Container, Sprite, Assets, Texture, Graphics, BitmapText, AnimatedSprite, TextureSource } from 'pixi.js';
import { Character } from './character';
import characterData from './jsons/characters.json';
import bgConfigs from './jsons/backgrounds.json';
import { loadPoseTextures } from './utils/loadPoseTextures';
import { sound } from '@pixi/sound';
import songData from './jsons/songs.json';
import gsap from 'gsap';


interface Slot {
    x: number;
    char: Character | null;
}

export class SceneRenderer {

    private GAME_WIDTH: number;
    private GAME_HEIGHT: number;
    private typeTimeout: number | null = null;
    public app: Application | null = null;
    public onExitRequest?: () => void;
    public onLoadRequest?: () => void;
    public onJumpRequest?: (index: number) => void;
    private playerTitleText!: BitmapText;
    private playPauseSprite!: Sprite;
    private loopSprite!: Sprite;
    private shuffleSprite!: Sprite;
    private currentTrackAlias: string | null = null;
    private slots: Record<string, Slot>;
    private nameText!: BitmapText;
    private dialogueText!: BitmapText;
    private currentTrackIndex: number = 0;
    private activePlaylist: string[] = [];
    private charsPerSecond = 30;
    private typingAccumulator = 0;
    private typingActive = false;
    private charIndex = 0;
    private recorderDestination: MediaStreamAudioDestinationNode | null = null;

    private scrollY: number = 0;
    private maxScrollY: number = 0;
    private scrollAreaHeight = 450;
    
    public currentFullText: string = "";
    private currentSpeechSound: string = 'speechHigh';
    private currentBgKey: string = "";
    
    public dialogueClickArea!: Graphics;
    private nextArrow!: Sprite;
    private customCursor!: AnimatedSprite;

    public isReady: boolean = false;
    private isShuffling: boolean = false;
    private isLooping: boolean = false;
    private isOverDialogue: boolean = false;
    private isTyping: boolean = false;
    private skipRequested: boolean = false;

    private readonly MAX_TEXT_WIDTH = 700;
    private readonly MAX_TEXT_HEIGHT = 135;
    private readonly DEFAULT_FONT_SIZE = 34;
    private readonly LEFT_SLOT_X = 230;
    private readonly CENTER_SLOT_X = 400;
    private readonly RIGHT_SLOT_X = 590;
    private readonly DIALOGUE_CLICK_AREA_X = 40;
    private readonly DIALOGUE_CLICK_AREA_Y = 580;
    private readonly TEXT_START_X = 51;
    private readonly TEXT_START_Y = 592;
    private readonly NEXT_ARROW_X = 884;
    private readonly NEXT_ARROW_Y = 700;
    private readonly PLAYER_BLUE = "#264BFF";
    private readonly TITLE_MAX_WIDTH = 400;

    private frameListContainer!: Container;
    private loadButton!: Container;
    private loadMenu!: Container;
    private jukeboxButton!: Container;
    private jukeboxPlayer!: Container;
    private exitButton!: Container;
    private mainContainer: Container;
    private bgLayer: Container;
    private charLayer: Container;
    private uiLayer: Container;
    private textLayer: Container;

    private currentNameColor: string = "0xFFFFFF";
    private currentPrefix: string = "";

    constructor(width: number, height: number) {
        this.GAME_WIDTH = width;
        this.GAME_HEIGHT = height;

        this.mainContainer = new Container();
        this.bgLayer = new Container();
        this.charLayer = new Container();
        this.uiLayer = new Container();
        this.textLayer = new Container();
        this.exitButton = new Container();

        this.slots = {
            left: { x: this.LEFT_SLOT_X, char: null },
            center: {x: this.CENTER_SLOT_X, char: null},
            right: { x: this.RIGHT_SLOT_X, char: null }
        };
    }

    async init() {

        this.charLayer.eventMode = 'none';
        this.uiLayer.eventMode = 'passive';
        this.textLayer.eventMode = 'passive'; 
        this.bgLayer.eventMode = 'passive'; 

        this.app = new Application();
        await this.app.init({
            width: this.GAME_WIDTH,
            height: this.GAME_HEIGHT,
            antialias: false,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            roundPixels: true
        })

        this.app.ticker.add((ticker) => this.update(ticker.deltaTime));

        TextureSource.defaultOptions.scaleMode = 'nearest';

        this.app!.renderer.events.cursorStyles.va11 = "url('assets/main/cursor.webp'), auto";

        await Assets.load([
            { alias: 'CyberpunkWaifus', src: 'assets/main/fonts/CyberpunkWaifus.fnt' },
            { alias: 'speechHigh', src: 'assets/sounds/speechHigh.mp3' },
            { alias: 'speechLow', src: 'assets/sounds/speechLow.mp3' }
        ]);

        await Assets.load([
            { alias: 'prev-track', src: 'assets/main/ui/prev-track.png' },
            { alias: 'play', src: 'assets/main/ui/play.png' },
            { alias: 'pause', src: 'assets/main/ui/pause.png' },
            { alias: 'next-track', src: 'assets/main/ui/next-track.png' },
            { alias: 'random-track', src: 'assets/main/ui/random-track.png' },
            { alias: 'loop-track', src: 'assets/main/ui/loop-track.png' },
        ]);

        const borderTexture = await Assets.load('assets/main/border.png');
        this.setBorder(borderTexture);

        this.mainContainer.addChild(this.bgLayer);
        this.mainContainer.addChild(this.charLayer);
        this.mainContainer.addChild(this.uiLayer);
        this.mainContainer.addChild(this.textLayer);
        this.app!.stage.addChild(this.mainContainer);

        window.addEventListener('resize', () => this.resize());
        this.resize();

        await this.setupDialogue(); 
        this.setupExitButton();
        this.setupLoadButton();
        this.setupLoadMenu(); 
        this.setupJukeboxButton();
        this.setupJukeboxPlayer();
        this.isReady = true;

        this.app!.canvas.style.cursor = this.app.renderer.events.cursorStyles.va11;

    }

    public async setupDialogue() {

        const cursorFrames = [
            await Assets.load('assets/main/dialogue-cursor-1.png'),
            await Assets.load('assets/main/dialogue-cursor-2.png'),
            await Assets.load('assets/main/dialogue-cursor-3.png'),
            await Assets.load('assets/main/dialogue-cursor-4.png'),
        ];

        this.customCursor = new AnimatedSprite(cursorFrames);
        this.customCursor.eventMode = 'none';
        this.customCursor.animationSpeed = 0.05;
        this.customCursor.visible = false
        this.customCursor.play();

        this.nextArrow = new Sprite(await Assets.load('assets/main/next_arrow.png'));
        this.nextArrow.x = this.NEXT_ARROW_X;
        this.nextArrow.y = this.NEXT_ARROW_Y;
        this.nextArrow.visible = false;
        this.textLayer.addChild(this.nextArrow);
        
        this.dialogueClickArea = new Graphics()
            .rect(0, 0, this.MAX_TEXT_WIDTH + 180, this.MAX_TEXT_HEIGHT + 10)
            .fill({color: 0xffffff, alpha: 0})
            
        this.dialogueClickArea.x = this.DIALOGUE_CLICK_AREA_X; 
        this.dialogueClickArea.y = this.DIALOGUE_CLICK_AREA_Y;

        this.dialogueClickArea.eventMode = 'static';

        this.nameText = new BitmapText({
            text: "",
            style: {
                fontFamily: "CyberpunkWaifus",
                fontSize: this.DEFAULT_FONT_SIZE,
            }
        });
        this.nameText.x = this.TEXT_START_X;
        this.nameText.y = this.TEXT_START_Y;

        this.dialogueText = new BitmapText({
            text: "",
            style: {
                fontFamily: "CyberpunkWaifus",
                fontSize: this.DEFAULT_FONT_SIZE,
                wordWrap: true,
                wordWrapWidth: this.MAX_TEXT_WIDTH,
            }
        });

        this.dialogueText.x = this.TEXT_START_X; 
        this.dialogueText.y = this.TEXT_START_Y;

        this.dialogueClickArea.on('pointerenter', () => {
            this.isOverDialogue = true;
            this.customCursor.visible = true;

            this.app.canvas.style.cursor = 'none';
        });

        this.dialogueClickArea.on('pointerleave', () => {
            this.isOverDialogue = false;
            this.customCursor.visible = false;
            this.app.canvas.style.cursor = 'auto';

            const styles = this.app!.renderer.events.cursorStyles as any;
            this.app!.canvas.style.cursor = styles.va11;
        });

        this.app.stage.eventMode = 'static';
        
        this.app.stage.on('globalpointermove', (event) => {
            if (this.isOverDialogue) {

                // calculate position relative to mainContainer.
                const localPos = this.mainContainer.toLocal(event.global);
                
                this.customCursor.x = localPos.x;
                this.customCursor.y = localPos.y;
            }
        });

        this.textLayer.addChild(this.dialogueText, this.nameText);
        this.textLayer.addChild(this.dialogueClickArea);
        this.mainContainer.addChild(this.customCursor); 
        
    }

    public adjustFontSize(fullText: string) {
        let currentSize = this.DEFAULT_FONT_SIZE;
        
        this.dialogueText.text = fullText;
        this.dialogueText.style.fontSize = currentSize;
        this.nameText.style.fontSize = currentSize;

        while (this.dialogueText.height > this.MAX_TEXT_HEIGHT && currentSize > 18) {
            currentSize -= 2;
            this.dialogueText.style.fontSize = currentSize;
            this.nameText.style.fontSize = currentSize;
        }
    }

    private update(delta: number) {
        if (!this.typingActive || !this.isTyping) return;

        const msPassed = delta * (1000 / 60);
        
        this.typingAccumulator += msPassed;

        const msPerChar = 1000 / this.charsPerSecond;

        while (this.typingAccumulator >= msPerChar) {
            this.typingAccumulator -= msPerChar;
            this.typeNextChar();
        }
    }

    private typeNextChar() {
        const prefixLen = this.currentPrefix.length;
        const totalLen = this.currentFullText.length;

        if (this.charIndex < totalLen) {
            const char = this.currentFullText[this.charIndex];

            if (this.charIndex % 4 === 0 && this.currentSpeechSound == "speechHigh") {
                try { sound.play(this.currentSpeechSound, { volume: 0.5 }); } catch(e) {}
            }

            if (this.charIndex % 5 === 0 && this.currentSpeechSound == "speechLow") {
                try { sound.play(this.currentSpeechSound, { volume: 0.5 }); } catch(e) {}
            }

            if (this.charIndex < prefixLen) {
                this.nameText.text += char;
                this.dialogueText.text += " "; 
            } else {
                this.dialogueText.text = this.currentPrefix + this.currentFullText.substring(prefixLen, this.charIndex + 1);
            }

            this.charIndex++;
        } else {
            this.finishTyping();
        }
    }


    public typeWrite(speakerId: string | null) {
        if (this.skipRequested) {
            this.finishTyping();
            return;
        }

        this.isTyping = true;
        this.typingActive = true;
        this.typingAccumulator = 0;
        this.charIndex = 0;

        this.adjustFontSize(this.currentFullText);
        this.nameText.tint = this.currentNameColor;
        this.nameText.text = "";
        this.dialogueText.text = "";

        Object.values(this.slots).forEach(s => s.char?.setTalking(false));
        const talkingChar = this.findCharInSlots(speakerId);
        if (talkingChar) talkingChar.setTalking(true);
    }

    public setDialogueInstant(text: string, name: string, color: string = "0xFFFFFF") {
        if (!this.isReady || !this.dialogueText) return;
        
        const prefix = name ? `${name}: ` : "";
        this.currentFullText = prefix + text;

        this.adjustFontSize(this.currentFullText);
        
        this.nameText.text = prefix;
        this.nameText.tint = color;
        this.dialogueText.text = this.currentFullText;
        this.isTyping = false;
        
        if (this.typeTimeout) window.clearTimeout(this.typeTimeout);
    }

    public finishTyping() {
        this.isTyping = false; 
        this.typingActive = false;
        this.skipRequested = true;

        this.nameText.text = this.currentPrefix;
        this.nameText.tint = this.currentNameColor;
        this.dialogueText.text = this.currentFullText;

        Object.values(this.slots).forEach(s => s.char?.setTalking(false));

        gsap.killTweensOf(this.nextArrow);
        this.nextArrow.visible = true;
        this.nextArrow.alpha = 1;
        gsap.to(this.nextArrow, { alpha: 0, duration: 0.5, repeat: -1, yoyo: true, ease: "steps(1)" });
    }

    private findCharInSlots(id: string | null) {
        if (!id) return null;
        for (const slotKey in this.slots) {
            const slot = this.slots[slotKey as 'left' | 'center' | 'right'];
            if (slot.char && slot.char.characterKey === id) return slot.char;
        }
        return null;
    }

    public getBusy(): boolean {
        return this.isTyping;
    }

    public async setBackground(bgKey: string) {

        if (!this.isReady) return;

        if (this.currentBgKey === bgKey) return;
        this.currentBgKey = bgKey;

        this.bgLayer.removeChildren();

        const config = (bgConfigs as any)[bgKey];

        const baseTexture = await Assets.load(config.base);
        const baseSprite = new Sprite(baseTexture);
        baseSprite.x = config.offsets.x; baseSprite.y = config.offsets.y;
        this.bgLayer.addChild(baseSprite);

        if (config.animations) {
            for (const animData of config.animations) {
                const textures = await Promise.all(animData.frames.map((f: string) => Assets.load(f)));
                const anim = new AnimatedSprite(textures);
                anim.x = animData.x;
                anim.y = animData.y;
                anim.animationSpeed = animData.speed;
                anim.play();
                this.bgLayer.addChild(anim);
            }
        }

        if (config.interactive) {
            for (const tvData of config.interactive) {
                await this.createTV(tvData);
            }
        }
    }

    private async createTV(data: any) {
        const textures = await Promise.all(data.channels.map((c: string) => Assets.load(c)));
        let currentChannel = 0;

        const tvSprite = new Sprite(textures[currentChannel]);
        tvSprite.x = data.x;
        tvSprite.y = data.y;

        tvSprite.eventMode = 'static';

        tvSprite.on('pointerdown', (event) => {
            event.stopPropagation(); 
            currentChannel = (currentChannel + 1) % textures.length;
            tvSprite.texture = textures[currentChannel];
        });

        this.bgLayer.addChild(tvSprite);
    }

    setBorder(texture: Texture) {
        this.uiLayer.removeChildren();
        const border = new Sprite(texture);
        border.texture.source.scaleMode = 'nearest';
        border.eventMode = 'none'; 
        this.uiLayer.addChild(border);
    }

    public async updateCharacters(newCharacters: { left?: any, center?: any, right?: any }) {
        if (!this.isReady) return;

        const loadPromises: Promise<any>[] = [];
        const characterConfigs: any = {};

        for (const [slot, data] of Object.entries(newCharacters)) {
            if (data) {
                const charEntry = (characterData as any)[data.id]; 
                const pose = (charEntry as any).poses[data.pose];
                
                loadPromises.push(loadPoseTextures(pose).then(tex => {
                    characterConfigs[data.id] = { 
                        textures: tex, 
                        offsets: pose.offsets, 
                        scale: charEntry.baseScale,
                        options: {
                            animSpeed: pose.sprites.animSpeed || 0.05,
                            animInterval: pose.sprites.animInterval || null
                        } 
                    };
                }));
            }
        }
        await Promise.all(loadPromises);
        
        const stageInstances: Record<string, Character> = {};
        for (const slotKey in this.slots) {
            const char = this.slots[slotKey as 'left' | 'center' | 'right'].char;
            if (char) {
                stageInstances[char.characterKey] = char;
                this.slots[slotKey as 'left' | 'center' | 'right'].char = null;
            }
        }

        const activeKeysInNewFrame = new Set(Object.values(newCharacters).filter(d => d).map(d => d.id));

        // Handle Exits (Fade out characters no longer needed)
        for (const charKey in stageInstances) {
            if (!activeKeysInNewFrame.has(charKey)) {
                const vanishingChar = stageInstances[charKey];
                gsap.killTweensOf(vanishingChar.view);
                gsap.to(vanishingChar.view, {
                    alpha: 0,
                    duration: 0.4,
                    ease: "steps(4)",
                    onComplete: () => vanishingChar.destroy()
                });
                delete stageInstances[charKey];
            }
        }

        // Handle Movements and Entries
        for (const [slotName, data] of Object.entries(newCharacters)) {
            const targetSlot = slotName as 'left' | 'center' | 'right';
            if (!data) continue;

            const config = characterConfigs[data.id];
            const targetX = this.slots[targetSlot].x;
            const existingChar = stageInstances[data.id];

            if (existingChar) {
                this.slots[targetSlot].char = existingChar;
                gsap.killTweensOf(existingChar.view);
                
                existingChar.updatePose(config.textures, config.offsets, config.options);

                if (existingChar.view.x !== targetX) {
                    gsap.to(existingChar.view, { x: targetX, duration: 0.5, ease: "power2.out" });
                }
                gsap.to(existingChar.view, { alpha: 1, duration: 0.2 });
                
            } else {
                const newChar = new Character(data.id, config.textures, config.offsets, {
                    x: targetX,
                    scale: config.scale,
                    ...config.options
                });
                newChar.view.alpha = 0;
                this.slots[targetSlot].char = newChar;
                this.charLayer.addChild(newChar.view);
                gsap.to(newChar.view, { alpha: 1, duration: 0.5, ease: "steps(4)" });
            }
        }
    }

    public resize(width?: number, height?: number) {
        if (!this.app) return;

        const targetWidth = width || window.innerWidth;
        const targetHeight = height || window.innerHeight;

        // Resize the actual renderer canvas to the CONTAINER size
        this.app.renderer.resize(targetWidth, targetHeight);

        // Calculate scale to fit the 1366x768 game inside the CONTAINER
        const scale = Math.min(
            targetWidth / this.GAME_WIDTH, 
            targetHeight / this.GAME_HEIGHT
        );

        this.mainContainer.scale.set(scale);

        // Center the game inside the CONTAINER
        this.mainContainer.x = (targetWidth - this.GAME_WIDTH * scale) / 2;
        this.mainContainer.y = (targetHeight - this.GAME_HEIGHT * scale) / 2;
    }

    private setupExitButton() {
        this.exitButton = new Container();
        
        const text = new BitmapText({
            text: "Exit",
            style: {
                fontFamily: "CyberpunkWaifus",
                fontSize: this.DEFAULT_FONT_SIZE,
            }
        });

        this.exitButton.addChild(text);

        this.exitButton.x = 1170;
        this.exitButton.y = 662;

        this.exitButton.eventMode = 'static';

        this.exitButton.on('pointerdown', (e) => {
            e.stopPropagation();
            if (this.onExitRequest) this.onExitRequest();
        });

        this.uiLayer.addChild(this.exitButton);
    }

    private setupLoadButton() {
        this.loadButton = new Container();
        
        const text = new BitmapText({
            text: "Load",
            style: {
                fontFamily: "CyberpunkWaifus",
                fontSize: this.DEFAULT_FONT_SIZE,
            }
        });

        this.loadButton.addChild(text);

        this.loadButton.x = 1170;
        this.loadButton.y = 605;

        this.loadButton.eventMode = 'static';

        this.loadButton.on('pointerdown', (e) => {
            e.stopPropagation();
            this.toggleLoadMenu(true);
        });

        this.uiLayer.addChild(this.loadButton);
    }

    private setupLoadMenu() {
        this.loadMenu = new Container();
        this.loadMenu.visible = false;

        const overlay = new Graphics()
            .rect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT)
            .fill({ color: 0x000000, alpha: 0.95 });
        overlay.eventMode = 'static'; 
        
        const title = new BitmapText({
            text: "--- SELECT JUMP POINT ---",
            style: { fontFamily: "CyberpunkWaifus", fontSize: 40 }
        });
        title.x = (this.GAME_WIDTH - title.width) / 2;
        title.y = 50;

        const viewport = new Container();
        viewport.y = 150;
        
        const mask = new Graphics()
            .rect(0, 0, this.GAME_WIDTH, this.scrollAreaHeight)
            .fill(0xffffff);
        
        viewport.mask = mask;
        viewport.addChild(mask);

        this.frameListContainer = new Container();
        viewport.addChild(this.frameListContainer);

        const backBtn = new BitmapText({
            text: "[ BACK TO BAR ]",
            style: { fontFamily: "CyberpunkWaifus", fontSize: 24 }
        });
        backBtn.x = (this.GAME_WIDTH - backBtn.width) / 2;
        backBtn.y = 680;
        backBtn.eventMode = 'static';
        backBtn.cursor = 'pointer';
        backBtn.on('pointerdown', (e) => { e.stopPropagation(); this.toggleLoadMenu(false); });

        this.loadMenu.addChild(overlay, title, viewport, backBtn);
        this.textLayer.addChild(this.loadMenu);

        this.app!.canvas.addEventListener('wheel', (e) => {
            if (!this.loadMenu.visible) return;
            e.preventDefault();
            this.handleScroll(e.deltaY);
        }, { passive: false });
    }

    private handleScroll(deltaY: number) {
        const scrollSpeed = 0.5;
        this.scrollY -= deltaY * scrollSpeed;

        if (this.scrollY > 0) this.scrollY = 0;
        if (this.scrollY < -this.maxScrollY) this.scrollY = -this.maxScrollY;

        this.frameListContainer.y = this.scrollY;
    }

    public populateLoadMenu(frameCount: number) {
        this.frameListContainer.removeChildren();
        this.scrollY = 0;
        this.frameListContainer.y = 0;

        const columns = 8;
        const spacingX = 110;
        const spacingY = 70;
        const startX = (this.GAME_WIDTH - (columns - 1) * spacingX) / 2;

        for (let i = 0; i < frameCount; i++) {
            const frameBtn = new BitmapText({
                text: (i + 1).toString().padStart(2, '0'),
                style: { fontFamily: "CyberpunkWaifus", fontSize: 26 }
            });

            frameBtn.x = startX + (i % columns) * spacingX;
            frameBtn.y = Math.floor(i / columns) * spacingY;
            
            frameBtn.eventMode = 'static';
            frameBtn.cursor = 'pointer';
            
            frameBtn.on('pointerover', () => { frameBtn.tint = 0x00FFFF; });
            frameBtn.on('pointerout', () => { frameBtn.tint = 0xFFFFFF; });
            frameBtn.on('pointerdown', (e) => {
                e.stopPropagation();
                if (this.onJumpRequest) this.onJumpRequest(i);
                this.toggleLoadMenu(false);
            });

            this.frameListContainer.addChild(frameBtn);
        }

        const totalRows = Math.ceil(frameCount / columns);
        const totalHeight = totalRows * spacingY;
        
        this.maxScrollY = Math.max(0, totalHeight - this.scrollAreaHeight + 40);
    }

    public toggleLoadMenu(show: boolean) {
        this.loadMenu.visible = show;
    }

    public async startPlaylist(songIds: string[]) {
        if (songIds.length === 0) {
            this.stopMusic();
            return;
        }
        
        const isSame = this.activePlaylist.length === songIds.length && 
                    this.activePlaylist.every((val, index) => val === songIds[index]);
        
        if (isSame && this.currentTrackAlias) return; 

        this.activePlaylist = songIds;
        this.playTrack(0);
    }

    private async playTrack(index: number) {
        if (this.activePlaylist.length === 0) return;

        this.currentTrackIndex = index;
        const songId = this.activePlaylist[this.currentTrackIndex];
        const songConfig = songData.find(s => s.id === songId);
        
        if (!songConfig) return;

        sound.stopAll();
        if (!Assets.cache.has(songId)) {
            Assets.add({ alias: songId, src: songConfig.file });
            await Assets.load(songId);
        }

        this.setTruncatedTitle(songConfig.title);
        
        if (this.playPauseSprite) this.playPauseSprite.texture = Assets.get('pause');

        sound.play(songId, {
            volume: 0.3,
            complete: () => {
                if (this.isLooping) {
                    this.playTrack(this.currentTrackIndex);
                } else {
                    this.playNextTrack();
                }
            }
        });
    }

    public playNextTrack() {
        let nextIndex;

        if (this.isShuffling && this.activePlaylist.length > 1) {
            nextIndex = this.currentTrackIndex;
            while (nextIndex === this.currentTrackIndex) {
                nextIndex = Math.floor(Math.random() * this.activePlaylist.length);
            }
        } else {
            nextIndex = (this.currentTrackIndex + 1) % this.activePlaylist.length;
        }

        this.playTrack(nextIndex);
    }

    public playPreviousTrack() {
        const prevIndex = (this.currentTrackIndex - 1 + this.activePlaylist.length) % this.activePlaylist.length;
        this.playTrack(prevIndex);
    }

    private toggleLoop() {
        this.isLooping = !this.isLooping;
        this.loopSprite.tint = this.isLooping ? "#f2c222" : 0xFFFFFF; 
    }

    public stopMusic() {
        sound.stopAll();
    }
    
    private setupJukeboxButton() {
        this.jukeboxButton = new Container();
        const text = new BitmapText({
            text: "Jukebox",
            style: { fontFamily: "CyberpunkWaifus", fontSize: this.DEFAULT_FONT_SIZE }
        });
        this.jukeboxButton.addChild(text);
        
        this.jukeboxButton.x = 960;
        this.jukeboxButton.y = 662;
        this.jukeboxButton.eventMode = 'static';

        this.jukeboxButton.on('pointerdown', (e) => {
            e.stopPropagation();
            this.toggleJukebox();
        });

        this.uiLayer.addChild(this.jukeboxButton);
    }

    private setupJukeboxPlayer() {
        this.jukeboxPlayer = new Container();
        this.jukeboxPlayer.visible = false;

        const width = 401;
        const height = 130;
        const playerX = -122;
        const playerY = -390;

        const bg = new Graphics()
            .rect(playerX, playerY, width, height)
            .fill(this.PLAYER_BLUE);
        this.jukeboxPlayer.addChild(bg);
        
        const playerLabel = new BitmapText({ 
            text: "Music Player", 
            style: { fontFamily: "CyberpunkWaifus", fontSize: 30 } 
        });
        playerLabel.x = playerX + 15;
        playerLabel.y = playerY + 7;

        this.playerTitleText = new BitmapText({ 
            text: "OFFLINE", 
            style: { fontFamily: "CyberpunkWaifus", fontSize: 30 } 
        });
        this.playerTitleText.x = playerX + 10;
        this.playerTitleText.y = playerY + height - 40;

        this.jukeboxPlayer.addChild(playerLabel, this.playerTitleText);

        const controls = new Container();
        controls.y = playerY + 55;

        // PREVIOUS
        const prev = new Sprite(Assets.get('prev-track'));
        prev.x = playerX + 20;
        prev.eventMode = 'static';
        prev.cursor = 'pointer';
        prev.on('pointerdown', (e) => { e.stopPropagation(); this.playPreviousTrack(); });

        // PLAY/PAUSE
        this.playPauseSprite = new Sprite(Assets.get('play'));
        this.playPauseSprite.scale.set(1.1);
        this.playPauseSprite.x = playerX + 100;
        this.playPauseSprite.eventMode = 'static';
        this.playPauseSprite.cursor = 'pointer';
        this.playPauseSprite.on('pointerdown', (e) => { e.stopPropagation(); this.togglePlayPause(); });

        // NEXT
        const next = new Sprite(Assets.get('next-track'));
        next.x = playerX + 150;
        next.eventMode = 'static';
        next.cursor = 'pointer';
        next.on('pointerdown', (e) => { e.stopPropagation(); this.playNextTrack(); });

        // RANDOM
        this.shuffleSprite = new Sprite(Assets.get('random-track'));
        this.shuffleSprite.x = playerX + 235;
        this.shuffleSprite.y = -6;
        this.shuffleSprite.eventMode = 'static';
        this.shuffleSprite.cursor = 'pointer';
        this.shuffleSprite.on('pointerdown', (e) => { 
            e.stopPropagation(); 
            this.toggleShuffle(); 
        });

        // LOOP
        this.loopSprite = new Sprite(Assets.get('loop-track'));
        this.loopSprite.x = playerX + 310;
        this.loopSprite.y = -2;
        this.loopSprite.eventMode = 'static';
        this.loopSprite.cursor = 'pointer';
        this.loopSprite.on('pointerdown', (e) => { e.stopPropagation(); this.toggleLoop(); });

        controls.addChild(prev, this.playPauseSprite, next, this.shuffleSprite, this.loopSprite);
        this.jukeboxPlayer.addChild(controls);

        this.jukeboxPlayer.x = 1050;
        this.jukeboxPlayer.y = 450;
        this.uiLayer.addChild(this.jukeboxPlayer);
    }

    public toggleJukebox() {
        this.jukeboxPlayer.visible = !this.jukeboxPlayer.visible;
    }

    private togglePlayPause() {
        const songId = this.activePlaylist[this.currentTrackIndex];
        if (!songId) return;

        if (sound.find(songId).paused) {
            sound.resume(songId);
            this.playPauseSprite.texture = Assets.get('pause');
        } else {
            sound.pause(songId);
            this.playPauseSprite.texture = Assets.get('play');
        }
    }

    public toggleShuffle() {
        this.isShuffling = !this.isShuffling;
        this.shuffleSprite.tint = this.isShuffling ? "#f2c222" : 0xFFFFFF;
    }

    private setTruncatedTitle(title: string) {
        this.playerTitleText.text = title;

        if (this.playerTitleText.width > this.TITLE_MAX_WIDTH) {
            let currentText = title;
            
            while (this.playerTitleText.width > this.TITLE_MAX_WIDTH - 20 && currentText.length > 0) {
                currentText = currentText.slice(0, -1);
                this.playerTitleText.text = currentText + "...";
            }
        }
    }

   
    public prepareForNewFrame(text: string, name: string, color: string, speechSound: string) {
        this.isTyping = true;
        this.skipRequested = false;

        this.currentNameColor = color;
        this.currentPrefix = name ? `${name}: ` : "";
        this.currentFullText = this.currentPrefix + text;
        this.currentSpeechSound = speechSound;
  
        if (this.typeTimeout) {
            window.clearTimeout(this.typeTimeout);
            this.typeTimeout = null;
        }

        this.nameText.text = "";
        this.dialogueText.text = "";
        gsap.killTweensOf(this.nextArrow);
        this.nextArrow.visible = false;
    }

    public getAudioStream(): MediaStream {
        const context = sound.context as any;
        const nativeCtx: AudioContext = context.audioContext;

        if (nativeCtx.state !== 'running') {
            nativeCtx.resume();
        }

        if (!this.recorderDestination) {
            this.recorderDestination = nativeCtx.createMediaStreamDestination();
            
            const masterNode = context.destination || context.gain;
            
            if (masterNode) {
                masterNode.connect(this.recorderDestination);
            }
        }

        return this.recorderDestination.stream;
    }

    public kickstartAudio() {
        try {
            sound.play('speechHigh', { volume: 0.01 });
        } catch (e) {}
    }

    public destroy() {
        this.isReady = false;
        if (this.app) {
            this.app.ticker.stop();
            
            try {
                this.app.destroy(true, { children: true, texture: false });
            } catch (e) {
                console.warn("Pixi cleanup warning:", e);
            }
            
            this.app = null;
        }
    }
}