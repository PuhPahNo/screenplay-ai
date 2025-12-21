import { describe, it, expect } from 'vitest';
import {
  isFieldEmpty,
  mergeEnrichedProfile,
  buildCharacterIdMap,
  parseEnrichmentResponse,
  applyEnrichments,
  extractCharacterEvidence,
  formatEvidenceForPrompt,
  type EnrichedCharacterProfile,
} from '../character-enrichment';
import type { Character } from '../../shared/types';
import type { FountainToken } from '../../renderer/fountain/parser';

// ============================================================================
// isFieldEmpty Tests
// ============================================================================

describe('isFieldEmpty', () => {
  it('returns true for undefined', () => {
    expect(isFieldEmpty(undefined)).toBe(true);
  });

  it('returns true for null', () => {
    expect(isFieldEmpty(null)).toBe(true);
  });

  it('returns true for empty string', () => {
    expect(isFieldEmpty('')).toBe(true);
  });

  it('returns true for whitespace-only string', () => {
    expect(isFieldEmpty('   ')).toBe(true);
    expect(isFieldEmpty('\t\n')).toBe(true);
  });

  it('returns false for non-empty string', () => {
    expect(isFieldEmpty('hello')).toBe(false);
    expect(isFieldEmpty('  hello  ')).toBe(false);
  });

  it('returns false for numbers', () => {
    expect(isFieldEmpty(0)).toBe(false);
    expect(isFieldEmpty(42)).toBe(false);
  });
});

// ============================================================================
// buildCharacterIdMap Tests
// ============================================================================

describe('buildCharacterIdMap', () => {
  it('builds map from character name (uppercase) to ID', () => {
    const characters: Character[] = [
      { id: 'char-1', name: 'John', description: '', arc: '', relationships: {}, appearances: [] },
      { id: 'char-2', name: 'SARAH', description: '', arc: '', relationships: {}, appearances: [] },
    ];

    const map = buildCharacterIdMap(characters);

    expect(map.get('JOHN')).toBe('char-1');
    expect(map.get('SARAH')).toBe('char-2');
    expect(map.get('john')).toBeUndefined(); // Map keys are uppercase
  });
});

// ============================================================================
// mergeEnrichedProfile Tests
// ============================================================================

describe('mergeEnrichedProfile', () => {
  const baseCharacter: Character = {
    id: 'char-1',
    name: 'JOHN',
    description: '',
    arc: '',
    relationships: {},
    appearances: ['scene-1'],
  };

  const idMap = new Map([
    ['JOHN', 'char-1'],
    ['SARAH', 'char-2'],
    ['BOB', 'char-3'],
  ]);

  it('fills empty fields with enriched values', () => {
    const enriched: EnrichedCharacterProfile = {
      name: 'JOHN',
      personality: 'Brave and determined',
      goals: 'Find the truth',
    };

    const result = mergeEnrichedProfile(baseCharacter, enriched, idMap);

    expect(result.personality).toBe('Brave and determined');
    expect(result.goals).toBe('Find the truth');
    expect(result.id).toBe('char-1'); // Unchanged
    expect(result.appearances).toEqual(['scene-1']); // Unchanged
  });

  it('does NOT overwrite non-empty existing fields', () => {
    const existing: Character = {
      ...baseCharacter,
      personality: 'User-defined personality',
      goals: 'User-defined goals',
    };

    const enriched: EnrichedCharacterProfile = {
      name: 'JOHN',
      personality: 'AI-generated personality',
      goals: 'AI-generated goals',
      fears: 'AI-generated fears',
    };

    const result = mergeEnrichedProfile(existing, enriched, idMap);

    expect(result.personality).toBe('User-defined personality'); // NOT overwritten
    expect(result.goals).toBe('User-defined goals'); // NOT overwritten
    expect(result.fears).toBe('AI-generated fears'); // Filled (was empty)
  });

  it('merges relationships without overwriting existing entries', () => {
    const existing: Character = {
      ...baseCharacter,
      relationships: {
        'char-2': 'User-defined relationship with Sarah',
      },
    };

    const enriched: EnrichedCharacterProfile = {
      name: 'JOHN',
      relationships: {
        'SARAH': 'AI relationship with Sarah',
        'BOB': 'AI relationship with Bob',
      },
    };

    const result = mergeEnrichedProfile(existing, enriched, idMap);

    // Sarah relationship unchanged (user-defined)
    expect(result.relationships['char-2']).toBe('User-defined relationship with Sarah');
    // Bob relationship added (was empty)
    expect(result.relationships['char-3']).toBe('AI relationship with Bob');
  });

  it('does not mutate the original character object', () => {
    const enriched: EnrichedCharacterProfile = {
      name: 'JOHN',
      personality: 'New personality',
    };

    const result = mergeEnrichedProfile(baseCharacter, enriched, idMap);

    expect(result).not.toBe(baseCharacter);
    expect(baseCharacter.personality).toBeUndefined();
    expect(result.personality).toBe('New personality');
  });
});

// ============================================================================
// parseEnrichmentResponse Tests
// ============================================================================

describe('parseEnrichmentResponse', () => {
  it('parses valid JSON with character array', () => {
    const json = JSON.stringify({
      characters: [
        { name: 'JOHN', personality: 'Brave', goals: 'Save the world' },
        { name: 'SARAH', occupation: 'Doctor' },
      ],
    });

    const result = parseEnrichmentResponse(json);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('JOHN');
    expect(result[0].personality).toBe('Brave');
    expect(result[1].name).toBe('SARAH');
    expect(result[1].occupation).toBe('Doctor');
  });

  it('normalizes character names to uppercase', () => {
    const json = JSON.stringify({
      characters: [{ name: 'john doe', personality: 'Nice' }],
    });

    const result = parseEnrichmentResponse(json);

    expect(result[0].name).toBe('JOHN DOE');
  });

  it('filters out entries without valid names', () => {
    const json = JSON.stringify({
      characters: [
        { name: 'VALID', personality: 'Good' },
        { name: '', personality: 'Bad' },
        { name: '   ', personality: 'Bad' },
        { personality: 'No name field' },
        null,
        'not an object',
      ],
    });

    const result = parseEnrichmentResponse(json);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('VALID');
  });

  it('returns empty array for invalid JSON', () => {
    const result = parseEnrichmentResponse('not valid json');
    expect(result).toEqual([]);
  });

  it('returns empty array if characters is not an array', () => {
    const json = JSON.stringify({ characters: 'not an array' });
    const result = parseEnrichmentResponse(json);
    expect(result).toEqual([]);
  });

  it('parses relationships object correctly', () => {
    const json = JSON.stringify({
      characters: [
        {
          name: 'JOHN',
          relationships: {
            'sarah': 'Best friend',
            'bob': 'Enemy',
          },
        },
      ],
    });

    const result = parseEnrichmentResponse(json);

    expect(result[0].relationships).toEqual({
      'SARAH': 'Best friend',
      'BOB': 'Enemy',
    });
  });

  it('ignores empty relationship values', () => {
    const json = JSON.stringify({
      characters: [
        {
          name: 'JOHN',
          relationships: {
            'sarah': 'Friend',
            'bob': '',
            'alice': '   ',
          },
        },
      ],
    });

    const result = parseEnrichmentResponse(json);

    expect(result[0].relationships).toEqual({ 'SARAH': 'Friend' });
  });
});

// ============================================================================
// applyEnrichments Tests
// ============================================================================

describe('applyEnrichments', () => {
  it('returns only characters that were actually modified', () => {
    const characters: Character[] = [
      { id: 'char-1', name: 'JOHN', description: '', arc: '', relationships: {}, appearances: [] },
      { id: 'char-2', name: 'SARAH', description: 'Already filled', arc: '', relationships: {}, appearances: [] },
    ];

    const enrichments: EnrichedCharacterProfile[] = [
      { name: 'JOHN', description: 'New description for John' },
      { name: 'SARAH', description: 'AI description for Sarah' }, // Should not apply
    ];

    const result = applyEnrichments(characters, enrichments);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('JOHN');
    expect(result[0].description).toBe('New description for John');
  });

  it('ignores enrichments for characters not in the list', () => {
    const characters: Character[] = [
      { id: 'char-1', name: 'JOHN', description: '', arc: '', relationships: {}, appearances: [] },
    ];

    const enrichments: EnrichedCharacterProfile[] = [
      { name: 'UNKNOWN', description: 'Should be ignored' },
    ];

    const result = applyEnrichments(characters, enrichments);

    expect(result).toHaveLength(0);
  });

  it('handles relationship ID mapping correctly', () => {
    const characters: Character[] = [
      { id: 'char-1', name: 'JOHN', description: '', arc: '', relationships: {}, appearances: [] },
      { id: 'char-2', name: 'SARAH', description: '', arc: '', relationships: {}, appearances: [] },
    ];

    const enrichments: EnrichedCharacterProfile[] = [
      {
        name: 'JOHN',
        relationships: { 'SARAH': 'Partner' },
      },
    ];

    const result = applyEnrichments(characters, enrichments);

    expect(result).toHaveLength(1);
    expect(result[0].relationships['char-2']).toBe('Partner');
  });
});

// ============================================================================
// extractCharacterEvidence Tests
// ============================================================================

describe('extractCharacterEvidence', () => {
  it('extracts dialogue excerpts for characters', () => {
    const tokens: FountainToken[] = [
      { type: 'scene-heading', text: 'INT. OFFICE - DAY', raw: 'INT. OFFICE - DAY' },
      { type: 'character', text: 'JOHN', raw: 'JOHN' },
      { type: 'dialogue', text: 'Hello there!', raw: 'Hello there!' },
      { type: 'dialogue', text: 'How are you?', raw: 'How are you?' },
    ];

    const characterNames = new Set(['JOHN']);
    const evidence = extractCharacterEvidence(tokens, characterNames);

    expect(evidence.get('JOHN')?.dialogueExcerpts).toHaveLength(1);
    expect(evidence.get('JOHN')?.dialogueExcerpts[0]).toContain('JOHN:');
    expect(evidence.get('JOHN')?.dialogueExcerpts[0]).toContain('Hello there!');
  });

  it('extracts action mentions for characters', () => {
    const tokens: FountainToken[] = [
      { type: 'scene-heading', text: 'INT. OFFICE - DAY', raw: 'INT. OFFICE - DAY' },
      { type: 'action', text: 'JOHN walks into the room and sits down.', raw: 'JOHN walks into the room.' },
    ];

    const characterNames = new Set(['JOHN']);
    const evidence = extractCharacterEvidence(tokens, characterNames);

    expect(evidence.get('JOHN')?.actionMentions).toHaveLength(1);
    expect(evidence.get('JOHN')?.actionMentions[0]).toContain('JOHN walks');
  });

  it('tracks co-occurrences between characters in scenes', () => {
    const tokens: FountainToken[] = [
      { type: 'scene-heading', text: 'INT. OFFICE - DAY', raw: 'INT. OFFICE - DAY' },
      { type: 'character', text: 'JOHN', raw: 'JOHN' },
      { type: 'dialogue', text: 'Hello!', raw: 'Hello!' },
      { type: 'character', text: 'SARAH', raw: 'SARAH' },
      { type: 'dialogue', text: 'Hi!', raw: 'Hi!' },
      { type: 'scene-heading', text: 'INT. HALLWAY - DAY', raw: 'INT. HALLWAY - DAY' },
    ];

    const characterNames = new Set(['JOHN', 'SARAH']);
    const evidence = extractCharacterEvidence(tokens, characterNames);

    expect(evidence.get('JOHN')?.coOccurrences['SARAH']).toBe(1);
    expect(evidence.get('SARAH')?.coOccurrences['JOHN']).toBe(1);
  });

  it('respects maxDialogueExcerpts option', () => {
    const tokens: FountainToken[] = [
      { type: 'scene-heading', text: 'INT. OFFICE - DAY', raw: '' },
      { type: 'character', text: 'JOHN', raw: '' },
      { type: 'dialogue', text: 'Line 1', raw: '' },
      { type: 'character', text: 'JOHN', raw: '' },
      { type: 'dialogue', text: 'Line 2', raw: '' },
      { type: 'character', text: 'JOHN', raw: '' },
      { type: 'dialogue', text: 'Line 3', raw: '' },
    ];

    const characterNames = new Set(['JOHN']);
    const evidence = extractCharacterEvidence(tokens, characterNames, { maxDialogueExcerpts: 2 });

    expect(evidence.get('JOHN')?.dialogueExcerpts).toHaveLength(2);
  });
});

// ============================================================================
// formatEvidenceForPrompt Tests
// ============================================================================

describe('formatEvidenceForPrompt', () => {
  it('formats evidence with all sections', () => {
    const evidence = {
      name: 'JOHN',
      dialogueExcerpts: ['JOHN:\nHello there!'],
      actionMentions: ['JOHN walks into the room.'],
      coOccurrences: { 'SARAH': 3, 'BOB': 1 },
      sceneCount: 5,
    };

    const formatted = formatEvidenceForPrompt(evidence);

    expect(formatted).toContain('### JOHN');
    expect(formatted).toContain('**Dialogue samples:**');
    expect(formatted).toContain('Hello there!');
    expect(formatted).toContain('**Action descriptions:**');
    expect(formatted).toContain('JOHN walks into the room.');
    expect(formatted).toContain('**Frequently appears with:**');
    expect(formatted).toContain('SARAH (3 scenes)');
  });

  it('handles empty evidence gracefully', () => {
    const evidence = {
      name: 'JOHN',
      dialogueExcerpts: [],
      actionMentions: [],
      coOccurrences: {},
      sceneCount: 0,
    };

    const formatted = formatEvidenceForPrompt(evidence);

    expect(formatted).toContain('### JOHN');
    expect(formatted).not.toContain('**Dialogue samples:**');
    expect(formatted).not.toContain('**Action descriptions:**');
  });
});

