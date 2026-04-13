import { Assets, TextureSource } from 'pixi.js';
import { SceneRenderer } from './sceneRenderer';
import { ScriptPlayer } from './ScriptPlayer';
import { GameController } from './gameController';
(async () => {

    TextureSource.defaultOptions.scaleMode = 'nearest';

    const renderer = new SceneRenderer(1366, 768);
    await renderer.init();

    renderer.app!.renderer.events.cursorStyles.va11 = "url('/assets/main/cursor.webp'), auto";
    renderer.app!.canvas.style.cursor = renderer.app.renderer.events.cursorStyles.va11;

    Assets.add({ alias: 'border', src: 'assets/main/border.png' });
    Assets.add({ alias: 'font', src: 'assets/main/fonts/CyberpunkWaifus.fnt' });
    Assets.add({ alias: "speechLow", src: 'assets/sounds/speechLow.mp3' });
    Assets.add({ alias: "speechHigh", src: 'assets/sounds/speechHigh.mp3' });

    const assets = await Assets.load(['border', 'font', 'speechLow', 'speechHigh']);

    renderer.setBorder(assets.border);

    const script = await (await fetch('/assets/data/script.json')).json();

    const player = new ScriptPlayer(renderer, script);
    new GameController(renderer, player);

    player.next();

})();
