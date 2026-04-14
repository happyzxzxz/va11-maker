import characterData from '../jsons/characters.json';

export const getCharacterEntry = (id: string | null) => {
    if (!id) return null;

    if ((characterData as any)[id]) {
        return (characterData as any)[id];
    }

    const lowerId = id.toLowerCase();
    const correctKey = Object.keys(characterData).find(
        key => key.toLowerCase() === lowerId
    );

    if (correctKey) {
        return (characterData as any)[correctKey];
    }

    return null;
};

export const getCorrectId = (id: string | null): string | null => {
    if (!id) return null;
    const lowerId = id.toLowerCase();
    return Object.keys(characterData).find(key => key.toLowerCase() === lowerId) || id;
};