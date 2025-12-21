/**
 * Character Enrichment Utilities
 * 
 * Pure functions for:
 * 1. Extracting bounded evidence from screenplay tokens for character profiles
 * 2. Merging AI-generated character data without overwriting user edits (fill-only-missing)
 */

import type { Character } from '../shared/types';
import type { FountainToken } from '../renderer/fountain/parser';

// ============================================================================
// Types
// ============================================================================

/** Evidence collected for a single character */
export interface CharacterEvidence {
  name: string;
  dialogueExcerpts: string[];      // First N dialogue blocks (speaker + lines)
  actionMentions: string[];        // Action lines that mention character name
  coOccurrences: Record<string, number>; // Other character names → scene co-occurrence count
  sceneCount: number;              // Total scenes where character appears
}

/** AI-generated enrichment for a character (from LLM JSON response) */
export interface EnrichedCharacterProfile {
  name: string;
  description?: string;
  age?: string;
  occupation?: string;
  physicalAppearance?: string;
  personality?: string;
  goals?: string;
  fears?: string;
  backstory?: string;
  arc?: string;
  notes?: string;
  relationships?: Record<string, string>; // other character name → relationship description
}

/** Options for evidence extraction */
export interface EvidenceExtractionOptions {
  maxDialogueExcerpts?: number;    // Default: 5
  maxActionMentions?: number;      // Default: 3
  maxDialogueLinesPerExcerpt?: number; // Default: 4
}

// ============================================================================
// Evidence Extraction
// ============================================================================

const DEFAULT_OPTIONS: Required<EvidenceExtractionOptions> = {
  maxDialogueExcerpts: 5,
  maxActionMentions: 3,
  maxDialogueLinesPerExcerpt: 4,
};

/**
 * Extract bounded evidence for all characters from parsed Fountain tokens.
 * 
 * @param tokens - Parsed Fountain tokens from FountainParserAdapter.parse()
 * @param characterNames - Set of known character names (uppercase)
 * @param options - Extraction limits
 * @returns Map of character name → evidence
 */
export function extractCharacterEvidence(
  tokens: FountainToken[],
  characterNames: Set<string>,
  options: EvidenceExtractionOptions = {}
): Map<string, CharacterEvidence> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const evidenceMap = new Map<string, CharacterEvidence>();

  // Initialize evidence for all known characters
  for (const name of characterNames) {
    evidenceMap.set(name, {
      name,
      dialogueExcerpts: [],
      actionMentions: [],
      coOccurrences: {},
      sceneCount: 0,
    });
  }

  // Track current scene characters for co-occurrence
  let currentSceneCharacters = new Set<string>();
  let inScene = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Scene boundary detection
    if (token.type === 'scene-heading') {
      // Finalize co-occurrences for previous scene
      if (inScene) {
        updateCoOccurrences(evidenceMap, currentSceneCharacters);
      }
      currentSceneCharacters = new Set();
      inScene = true;
      continue;
    }

    // Character dialogue detection
    if (token.type === 'character') {
      const speakerName = extractSpeakerName(token.text);
      if (speakerName && characterNames.has(speakerName)) {
        currentSceneCharacters.add(speakerName);
        const evidence = evidenceMap.get(speakerName);
        
        if (evidence && evidence.dialogueExcerpts.length < opts.maxDialogueExcerpts) {
          // Collect following dialogue lines
          const dialogueLines = collectDialogueLines(tokens, i + 1, opts.maxDialogueLinesPerExcerpt);
          if (dialogueLines.length > 0) {
            const excerpt = `${speakerName}:\n${dialogueLines.join('\n')}`;
            evidence.dialogueExcerpts.push(excerpt);
          }
        }
      }
      continue;
    }

    // Action line detection for character mentions
    if (token.type === 'action' && token.text.trim()) {
      const actionText = token.text;
      for (const charName of characterNames) {
        // Case-insensitive word boundary match
        const regex = new RegExp(`\\b${escapeRegex(charName)}\\b`, 'i');
        if (regex.test(actionText)) {
          currentSceneCharacters.add(charName);
          const evidence = evidenceMap.get(charName);
          if (evidence && evidence.actionMentions.length < opts.maxActionMentions) {
            // Truncate long action lines
            const truncated = actionText.length > 200 
              ? actionText.substring(0, 197) + '...'
              : actionText;
            evidence.actionMentions.push(truncated);
          }
        }
      }
    }
  }

  // Finalize last scene
  if (inScene) {
    updateCoOccurrences(evidenceMap, currentSceneCharacters);
  }

  // Count scenes per character (sum of co-occurrence entries + 1 for self)
  for (const evidence of evidenceMap.values()) {
    // Scene count = number of unique scenes where character appeared
    // Approximated by: dialogue excerpts + action mentions (capped)
    evidence.sceneCount = Math.max(
      evidence.dialogueExcerpts.length,
      Object.values(evidence.coOccurrences).reduce((a, b) => Math.max(a, b), 0)
    );
  }

  return evidenceMap;
}

/** Extract speaker name from character token (remove extensions like V.O., CONT'D) */
function extractSpeakerName(text: string): string | null {
  // Remove parenthetical extensions
  const cleaned = text.replace(/\s*\([^)]*\)\s*/g, '').trim().toUpperCase();
  return cleaned || null;
}

/** Collect dialogue lines following a character token */
function collectDialogueLines(
  tokens: FountainToken[],
  startIdx: number,
  maxLines: number
): string[] {
  const lines: string[] = [];
  for (let i = startIdx; i < tokens.length && lines.length < maxLines; i++) {
    const token = tokens[i];
    if (token.type === 'dialogue') {
      lines.push(token.text);
    } else if (token.type === 'parenthetical') {
      lines.push(`(${token.text.replace(/^\(|\)$/g, '')})`);
    } else if (token.type === 'character' || token.type === 'scene-heading' || token.type === 'action') {
      // Stop at next character, scene, or action
      break;
    }
  }
  return lines;
}

/** Update co-occurrence counts for all characters in a scene */
function updateCoOccurrences(
  evidenceMap: Map<string, CharacterEvidence>,
  sceneCharacters: Set<string>
): void {
  const chars = Array.from(sceneCharacters);
  for (let i = 0; i < chars.length; i++) {
    const charA = chars[i];
    const evidenceA = evidenceMap.get(charA);
    if (!evidenceA) continue;

    for (let j = 0; j < chars.length; j++) {
      if (i === j) continue;
      const charB = chars[j];
      evidenceA.coOccurrences[charB] = (evidenceA.coOccurrences[charB] || 0) + 1;
    }
  }
}

/** Escape special regex characters */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// Evidence Formatting for LLM Prompt
// ============================================================================

/**
 * Format evidence for a single character into a concise prompt section.
 */
export function formatEvidenceForPrompt(evidence: CharacterEvidence): string {
  const parts: string[] = [`### ${evidence.name}`];

  if (evidence.dialogueExcerpts.length > 0) {
    parts.push('**Dialogue samples:**');
    for (const excerpt of evidence.dialogueExcerpts) {
      parts.push(excerpt);
      parts.push('---');
    }
  }

  if (evidence.actionMentions.length > 0) {
    parts.push('**Action descriptions:**');
    for (const action of evidence.actionMentions) {
      parts.push(`- ${action}`);
    }
  }

  const topCoOccurrences = Object.entries(evidence.coOccurrences)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (topCoOccurrences.length > 0) {
    parts.push('**Frequently appears with:**');
    for (const [name, count] of topCoOccurrences) {
      parts.push(`- ${name} (${count} scenes)`);
    }
  }

  return parts.join('\n');
}

/**
 * Format all evidence into a bounded prompt section for the LLM.
 */
export function formatAllEvidenceForPrompt(
  evidenceMap: Map<string, CharacterEvidence>,
  maxCharacters: number = 20
): string {
  // Sort by dialogue count (most prominent characters first)
  const sorted = Array.from(evidenceMap.values())
    .sort((a, b) => b.dialogueExcerpts.length - a.dialogueExcerpts.length)
    .slice(0, maxCharacters);

  const sections = sorted.map(e => formatEvidenceForPrompt(e));
  return sections.join('\n\n');
}

// ============================================================================
// Fill-Only-Missing Merge Logic
// ============================================================================

/** Fields that can be enriched (excludes id, name, appearances, customAttributes, imageUrl) */
const ENRICHABLE_FIELDS: (keyof Character)[] = [
  'description',
  'age',
  'occupation',
  'physicalAppearance',
  'personality',
  'goals',
  'fears',
  'backstory',
  'arc',
  'notes',
];

/**
 * Check if a field value is considered "empty" (should be filled by AI).
 */
export function isFieldEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

/**
 * Merge enriched profile into existing character, filling only empty fields.
 * 
 * @param existing - Current character from database
 * @param enriched - AI-generated enrichment
 * @param characterIdMap - Map of character name (uppercase) → ID for relationship mapping
 * @returns Updated character (new object, does not mutate existing)
 */
export function mergeEnrichedProfile(
  existing: Character,
  enriched: EnrichedCharacterProfile,
  characterIdMap: Map<string, string>
): Character {
  const updated: Character = { ...existing };

  // Fill enrichable string fields
  for (const field of ENRICHABLE_FIELDS) {
    const enrichedValue = enriched[field as keyof EnrichedCharacterProfile];
    if (enrichedValue !== undefined && isFieldEmpty(existing[field])) {
      // Type assertion needed because Character has mixed types
      (updated as any)[field] = String(enrichedValue);
    }
  }

  // Merge relationships (fill only missing relationship entries)
  if (enriched.relationships) {
    const updatedRelationships = { ...existing.relationships };

    for (const [otherName, description] of Object.entries(enriched.relationships)) {
      // Map name to ID
      const otherId = characterIdMap.get(otherName.toUpperCase());
      if (otherId && isFieldEmpty(updatedRelationships[otherId])) {
        updatedRelationships[otherId] = description;
      }
    }

    updated.relationships = updatedRelationships;
  }

  return updated;
}

/**
 * Build a name → ID map for relationship mapping.
 */
export function buildCharacterIdMap(characters: Character[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const char of characters) {
    map.set(char.name.toUpperCase(), char.id);
  }
  return map;
}

// ============================================================================
// JSON Parsing & Validation
// ============================================================================

/**
 * Parse and validate LLM JSON response for character enrichments.
 * 
 * Expected format:
 * {
 *   "characters": [
 *     { "name": "JOHN", "personality": "...", "goals": "...", ... },
 *     ...
 *   ]
 * }
 * 
 * @param jsonString - Raw JSON string from LLM
 * @returns Array of validated enriched profiles (invalid entries filtered out)
 */
export function parseEnrichmentResponse(jsonString: string): EnrichedCharacterProfile[] {
  try {
    const parsed = JSON.parse(jsonString);
    
    if (!parsed || typeof parsed !== 'object') {
      console.warn('[Enrichment] Invalid JSON structure: not an object');
      return [];
    }

    const characters = parsed.characters;
    if (!Array.isArray(characters)) {
      console.warn('[Enrichment] Invalid JSON structure: "characters" is not an array');
      return [];
    }

    const validated: EnrichedCharacterProfile[] = [];
    for (const entry of characters) {
      if (!entry || typeof entry !== 'object') continue;
      if (typeof entry.name !== 'string' || entry.name.trim() === '') continue;

      // Normalize name
      const profile: EnrichedCharacterProfile = {
        name: entry.name.toUpperCase().trim(),
      };

      // Copy optional string fields
      const optionalFields = [
        'description', 'age', 'occupation', 'physicalAppearance',
        'personality', 'goals', 'fears', 'backstory', 'arc', 'notes'
      ] as const;

      for (const field of optionalFields) {
        if (typeof entry[field] === 'string' && entry[field].trim() !== '') {
          profile[field] = entry[field].trim();
        }
      }

      // Parse relationships object
      if (entry.relationships && typeof entry.relationships === 'object' && !Array.isArray(entry.relationships)) {
        profile.relationships = {};
        for (const [key, value] of Object.entries(entry.relationships)) {
          if (typeof value === 'string' && value.trim() !== '') {
            profile.relationships[key.toUpperCase().trim()] = value.trim();
          }
        }
      }

      validated.push(profile);
    }

    return validated;
  } catch (error) {
    console.error('[Enrichment] Failed to parse JSON:', error);
    return [];
  }
}

/**
 * Apply enrichments to a list of characters (fill-only-missing).
 * 
 * @param characters - Current characters from database
 * @param enrichments - Parsed enrichment profiles from LLM
 * @returns Array of updated characters (only those that were modified)
 */
export function applyEnrichments(
  characters: Character[],
  enrichments: EnrichedCharacterProfile[]
): Character[] {
  const charMap = new Map<string, Character>();
  for (const char of characters) {
    charMap.set(char.name.toUpperCase(), char);
  }

  const idMap = buildCharacterIdMap(characters);
  const updated: Character[] = [];

  for (const enriched of enrichments) {
    const existing = charMap.get(enriched.name);
    if (!existing) continue;

    const merged = mergeEnrichedProfile(existing, enriched, idMap);
    
    // Check if anything actually changed
    if (JSON.stringify(merged) !== JSON.stringify(existing)) {
      updated.push(merged);
    }
  }

  return updated;
}

