import type { IndexedScene } from '../../screenplay/scene-indexer';

function normalizeName(name: string): string {
  return name.toUpperCase().trim();
}

/**
 * Returns the scenes a character appears in, based on parsed screenplay scenes.
 * This is deterministic and matches what's in the screenplay text.
 */
export function getScenesForCharacter(parsedScenes: IndexedScene[], characterName: string): IndexedScene[] {
  const target = normalizeName(characterName);
  if (!target) return [];

  return parsedScenes.filter((scene) =>
    scene.characters.some((c) => normalizeName(c) === target)
  );
}

/**
 * Build a lookup map of CHARACTER_NAME (UPPERCASE) -> scene count.
 */
export function buildCharacterSceneCountMap(parsedScenes: IndexedScene[]): Map<string, number> {
  const map = new Map<string, number>();

  for (const scene of parsedScenes) {
    for (const name of scene.characters) {
      const key = normalizeName(name);
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
  }

  return map;
}


