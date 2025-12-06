/**
 * SceneIndexer - Single source of truth for scene detection
 * 
 * This module provides deterministic scene indexing that aligns exactly with the
 * ScreenplayEditor's line indices. All scene navigation and counts should derive
 * from this indexer, not from the database or AI analysis.
 * 
 * Key guarantee: Scene.startLineIndex corresponds to the editor's data-line-index
 * attribute, enabling reliable scroll-to-scene navigation.
 */

import { FountainParserAdapter, type FountainToken } from '../renderer/fountain/parser';
import type { Scene } from '../shared/types';

export interface IndexedScene {
  id: string;
  number: number;
  heading: string;
  location: string;
  timeOfDay: string;
  /** Zero-based line index matching editor's data-line-index */
  startLineIndex: number;
  /** Zero-based line index of the last line of this scene (inclusive) */
  endLineIndex: number;
  /** Characters detected in this scene (names only, not IDs) */
  characters: string[];
  /** Raw content of the scene */
  content: string;
  summary: string;
}

// Patterns for parsing scene heading components
const SCENE_HEADING_PATTERN = /^(INT|EXT|INT\.\/EXT|INT\/EXT|I\/E|EST)[\.\s]+/i;

/**
 * Parse location and time of day from a scene heading
 */
function parseSceneHeading(heading: string): { location: string; timeOfDay: string } {
  // Remove the INT/EXT prefix
  const withoutPrefix = heading.replace(SCENE_HEADING_PATTERN, '');
  
  // Split by dash or hyphen to separate location and time
  const parts = withoutPrefix.split(/\s*[-–—]\s*/);
  
  const location = parts[0]?.trim() || '';
  const timeOfDay = parts[1]?.trim() || '';
  
  return { location, timeOfDay };
}

/**
 * Extract character names from dialogue sections within scene content tokens
 */
function extractSceneCharacters(tokens: FountainToken[], startIdx: number, endIdx: number): string[] {
  const characters = new Set<string>();
  
  for (let i = startIdx; i <= endIdx && i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'character') {
      // Clean up character name (remove extensions like V.O., O.S., etc.)
      let name = token.text.trim();
      name = name.replace(/\s*\([^)]+\)\s*$/, ''); // Remove parenthetical
      name = name.replace(/\s+\d+$/, ''); // Remove trailing numbers
      if (name) {
        characters.add(name);
      }
    }
  }
  
  return Array.from(characters);
}

/**
 * Build scene content from tokens
 */
function buildSceneContent(tokens: FountainToken[], startIdx: number, endIdx: number): string {
  const lines: string[] = [];
  for (let i = startIdx; i <= endIdx && i < tokens.length; i++) {
    lines.push(tokens[i].text);
  }
  return lines.join('\n');
}

/**
 * Index all scenes from screenplay content
 * 
 * This is the single source of truth for scene detection. It uses the same
 * normalization and tokenization as ScreenplayEditor, ensuring line indices
 * match exactly.
 * 
 * @param content - Raw screenplay content
 * @returns Array of IndexedScene objects with editor-aligned line indices
 */
export function indexScenes(content: string): IndexedScene[] {
  if (!content || content.trim() === '') {
    return [];
  }
  
  // Use the same normalization as ScreenplayEditor
  const normalizedContent = FountainParserAdapter.normalizeContent(content);
  
  // Parse using the same parser as the editor
  const parsed = FountainParserAdapter.parse(normalizedContent);
  const tokens = parsed.tokens;
  
  if (tokens.length === 0) {
    return [];
  }
  
  const scenes: IndexedScene[] = [];
  let sceneNumber = 0;
  
  // Find all scene heading token indices
  const sceneHeadingIndices: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === 'scene-heading') {
      sceneHeadingIndices.push(i);
    }
  }
  
  // Build scenes from heading indices
  for (let i = 0; i < sceneHeadingIndices.length; i++) {
    const startIdx = sceneHeadingIndices[i];
    // End at the token before the next scene heading, or at the last token
    const endIdx = i < sceneHeadingIndices.length - 1 
      ? sceneHeadingIndices[i + 1] - 1 
      : tokens.length - 1;
    
    const headingToken = tokens[startIdx];
    const { location, timeOfDay } = parseSceneHeading(headingToken.text);
    
    sceneNumber++;
    
    scenes.push({
      id: `scene-${sceneNumber}-${startIdx}`, // Deterministic ID based on position
      number: sceneNumber,
      heading: headingToken.text,
      location,
      timeOfDay,
      startLineIndex: startIdx,
      endLineIndex: endIdx,
      characters: extractSceneCharacters(tokens, startIdx, endIdx),
      content: buildSceneContent(tokens, startIdx, endIdx),
      summary: '',
    });
  }
  
  return scenes;
}

/**
 * Convert IndexedScene to the Scene type used by the app store
 * 
 * This provides compatibility with existing code that expects the Scene interface.
 * The key difference is that startLine/endLine are now aligned with editor indices.
 */
export function toStoreScene(indexed: IndexedScene): Scene {
  return {
    id: indexed.id,
    number: indexed.number,
    heading: indexed.heading,
    location: indexed.location,
    timeOfDay: indexed.timeOfDay,
    summary: indexed.summary,
    characters: indexed.characters, // Note: these are names, not IDs
    startLine: indexed.startLineIndex, // Now aligned with editor
    endLine: indexed.endLineIndex, // Now aligned with editor
    content: indexed.content,
  };
}

/**
 * Get the scene at a specific line index
 */
export function getSceneAtLine(scenes: IndexedScene[], lineIndex: number): IndexedScene | null {
  for (const scene of scenes) {
    if (lineIndex >= scene.startLineIndex && lineIndex <= scene.endLineIndex) {
      return scene;
    }
  }
  return null;
}

/**
 * Get scene count from content without full indexing (faster for counts only)
 */
export function countScenes(content: string): number {
  if (!content || content.trim() === '') {
    return 0;
  }
  
  const normalizedContent = FountainParserAdapter.normalizeContent(content);
  const parsed = FountainParserAdapter.parse(normalizedContent);
  
  return parsed.tokens.filter(t => t.type === 'scene-heading').length;
}

export const SceneIndexer = {
  indexScenes,
  toStoreScene,
  getSceneAtLine,
  countScenes,
};

export default SceneIndexer;

