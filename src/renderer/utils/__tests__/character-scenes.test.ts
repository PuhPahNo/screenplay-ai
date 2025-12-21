import { describe, it, expect } from 'vitest';
import { buildCharacterSceneCountMap, getScenesForCharacter } from '../character-scenes';
import type { IndexedScene } from '../../../screenplay/scene-indexer';

function makeScene(partial: Partial<IndexedScene>): IndexedScene {
  return {
    id: partial.id || 'scene-1',
    number: partial.number || 1,
    heading: partial.heading || 'INT. TEST - DAY',
    location: partial.location || '',
    timeOfDay: partial.timeOfDay || '',
    summary: partial.summary || '',
    characters: partial.characters || [],
    startLineIndex: partial.startLineIndex ?? 0,
    endLineIndex: partial.endLineIndex ?? 0,
    content: partial.content || '',
  };
}

describe('getScenesForCharacter', () => {
  it('returns scenes where the character appears (case-insensitive)', () => {
    const scenes: IndexedScene[] = [
      makeScene({ id: 's1', number: 1, characters: ['ALEX', 'BOB'] }),
      makeScene({ id: 's2', number: 2, characters: ['SARAH'] }),
      makeScene({ id: 's3', number: 3, characters: ['alex'] }),
    ];

    const alexScenes = getScenesForCharacter(scenes, 'Alex');
    expect(alexScenes.map((s) => s.id)).toEqual(['s1', 's3']);
  });

  it('returns empty array for empty name', () => {
    const scenes: IndexedScene[] = [makeScene({ id: 's1', characters: ['ALEX'] })];
    expect(getScenesForCharacter(scenes, '   ')).toEqual([]);
  });
});

describe('buildCharacterSceneCountMap', () => {
  it('counts scenes per character name (uppercase)', () => {
    const scenes: IndexedScene[] = [
      makeScene({ characters: ['ALEX', 'BOB'] }),
      makeScene({ characters: ['ALEX'] }),
      makeScene({ characters: ['sarah'] }),
    ];

    const map = buildCharacterSceneCountMap(scenes);
    expect(map.get('ALEX')).toBe(2);
    expect(map.get('BOB')).toBe(1);
    expect(map.get('SARAH')).toBe(1);
  });
});


