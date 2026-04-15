import { Assets, Texture } from 'pixi.js';
import { db } from './db';

async function resolveImage(pathOrId: string): Promise<Texture> {
    // Standart path
    if (pathOrId.startsWith('assets/')) {
        return await Assets.load(pathOrId);
    }

    // Custom character
    try {
        const entry = await db.images.get(pathOrId);
        if (entry && entry.data) {
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(entry.data as Blob);
            });

            const texture = await Assets.load(dataUrl);
            console.log(`Successfully parsed custom texture: ${pathOrId}`);
            return texture;
        }
    } catch (e) {
        console.error(`Database error for ${pathOrId}:`, e);
    }

    return Texture.WHITE;
}

export async function loadPoseTextures(poseData: any) {
    const body = await resolveImage(poseData.sprites.body);

    const resolveAndFilter = async (list: string[]) => {
        const results = await Promise.all((list || []).map(resolveImage));
        return results.filter(t => t && t !== Texture.WHITE);
    };

    const eyes = await resolveAndFilter(poseData.sprites.eyes);
    const mouth = await resolveAndFilter(poseData.sprites.mouth);
    const characterAnim = await resolveAndFilter(poseData.sprites.characterAnim);
    
    const staticCharAnim = poseData.sprites.staticCharAnim ? 
        await resolveImage(poseData.sprites.staticCharAnim) : null;

    return { body, eyes, mouth, characterAnim, staticCharAnim };
}