import { Assets, Texture } from 'pixi.js';

export async function loadPoseTextures(poseData: any) {
    const body = await Assets.load<Texture>(poseData.sprites.body);

    const eyes = poseData.sprites.eyes.length > 0 
        ? await Promise.all(poseData.sprites.eyes.map((path: string) => Assets.load<Texture>(path)))
        : [];

    const mouth = poseData.sprites.mouth.length > 0
        ? await Promise.all(poseData.sprites.mouth.map((path: string) => Assets.load<Texture>(path)))
        : [];

    const characterAnim = poseData.sprites.characterAnim?.length > 0
        ? await Promise.all(poseData.sprites.characterAnim.map((s: string) => Assets.load(s))) : [];

    const staticCharAnim = poseData.sprites.staticCharAnim ? 
        await Assets.load(poseData.sprites.staticCharAnim) : null;

    return { body, eyes, mouth, characterAnim, staticCharAnim };
}