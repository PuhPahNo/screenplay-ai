/**
 * Fountain Parser Adapter
 * Robust parser for Fountain screenplay format with proper AST and normalization
 */

import type { ElementType } from '../../shared/types';

export interface FountainToken {
  type: ElementType;
  text: string;
  raw: string; // Original text before normalization
  depth?: number; // For tracking blank lines/spacing
}

export interface ParsedFountain {
  title?: string;
  author?: string;
  draft?: string;
  date?: string;
  tokens: FountainToken[];
  characters: Set<string>;
  scenes: Array<{
    number: number;
    heading: string;
    startToken: number;
  }>;
}

// Patterns for element detection
const PATTERNS = {
  sceneHeading: /^(INT|EXT|INT\.\/EXT|INT\/EXT|I\/E|EST)[\.\s]/i,
  forcedSceneHeading: /^\./,
  transition: /^[A-Z\s]+TO:$/,
  forcedTransition: /^>\s*.+$/,
  centered: /^>.*<$/,
  pageBreak: /^={3,}$/,
  boneyard: /\/\*[\s\S]*?\*\//g,
  lineBreak: /^$/,
  sectionHeading: /^#+/,
  synopsis: /^=(?!=)/,
  note: /\[\[[\s\S]*?\]\]/g,
  titlePage: /^(Title|Credit|Author|Source|Draft|Date|Contact|Copyright|Notes|Revision):\s*/i,
  // Character detection: ALL CAPS, optional extension like (V.O.), not a transition
  character: /^[A-Z][A-Z0-9 '-]+(\s*\([^)]+\))?$/,
  parenthetical: /^\([^)]*\)$/,
};

// Words that are NOT characters when in all caps
const NOT_CHARACTERS = new Set([
  'THE END', 'CONTINUED', 'MORE', 'FADE IN', 'FADE OUT', 'FADE TO BLACK',
  'CUT TO', 'DISSOLVE TO', 'SMASH CUT TO', 'MATCH CUT TO', 'JUMP CUT TO',
  'TIME CUT', 'INTERCUT', 'BACK TO', 'FLASHBACK', 'END FLASHBACK',
  'DREAM SEQUENCE', 'END DREAM SEQUENCE', 'MONTAGE', 'END MONTAGE',
  'SERIES OF SHOTS', 'END SERIES OF SHOTS', 'CONTINUOUS', 'LATER',
  'MOMENTS LATER', 'SAME TIME', 'SPLIT SCREEN', 'END SPLIT SCREEN',
  'STOCK SHOT', 'ANGLE ON', 'CLOSE ON', 'INSERT', 'SUPER', 'TITLE',
  'SUBTITLE', 'V.O.', 'O.S.', 'O.C.', 'CONT\'D', 'CONTD', 'PRE-LAP',
]);

export class FountainParserAdapter {
  /**
   * Parse Fountain content into structured tokens
   */
  static parse(content: string): ParsedFountain {
    const result: ParsedFountain = {
      tokens: [],
      characters: new Set(),
      scenes: [],
    };

    // Normalize line endings
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Parse title page first
    const { titlePage, body } = this.parseTitlePage(normalized);
    if (titlePage) {
      result.title = titlePage.title;
      result.author = titlePage.author;
      result.draft = titlePage.draft;
      result.date = titlePage.date;
    }

    // Tokenize the body
    result.tokens = this.tokenize(body, result.characters, result.scenes);
    
    return result;
  }

  /**
   * Parse title page metadata
   */
  private static parseTitlePage(content: string): { titlePage: any; body: string } {
    const titlePage: Record<string, string> = {};
    const lines = content.split('\n');
    let bodyStart = 0;
    let inTitlePage = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for title page fields
      const match = line.match(PATTERNS.titlePage);
      if (match) {
        inTitlePage = true;
        const key = match[1].toLowerCase();
        const value = line.substring(match[0].length).trim();
        titlePage[key] = value;
        bodyStart = i + 1;
        continue;
      }
      
      // End of title page is marked by === or first non-title-page content
      if (PATTERNS.pageBreak.test(line.trim())) {
        bodyStart = i + 1;
        break;
      }
      
      // If we were in title page and hit a blank line, continue checking
      if (inTitlePage && line.trim() === '') {
        bodyStart = i + 1;
        continue;
      }
      
      // If we started reading title page but hit non-title content, stop
      if (inTitlePage && line.trim() !== '') {
        bodyStart = i;
        break;
      }
    }

    return {
      titlePage: Object.keys(titlePage).length > 0 ? titlePage : null,
      body: lines.slice(bodyStart).join('\n'),
    };
  }

  /**
   * Tokenize fountain body content
   */
  private static tokenize(
    content: string,
    characters: Set<string>,
    scenes: Array<{ number: number; heading: string; startToken: number }>
  ): FountainToken[] {
    const tokens: FountainToken[] = [];
    const lines = content.split('\n');
    let sceneNumber = 0;
    let prevType: ElementType | null = null;
    let consecutiveBlankLines = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const prevLine = i > 0 ? lines[i - 1].trim() : '';
      const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';

      // Track blank lines
      if (trimmed === '') {
        consecutiveBlankLines++;
        // Only output ONE blank line token per group of blanks
        if (consecutiveBlankLines === 1) {
          tokens.push({
            type: 'action',
            text: '',
            raw: line,
            depth: 0,
          });
        }
        prevType = null; // Reset context after blank line
        continue;
      }
      
      consecutiveBlankLines = 0;

      // Detect element type
      const token = this.detectElement(trimmed, line, prevLine, nextLine, prevType);
      
      // Track characters
      if (token.type === 'character') {
        const charName = this.extractCharacterName(trimmed);
        if (charName && !NOT_CHARACTERS.has(charName)) {
          characters.add(charName);
        }
      }
      
      // Track scenes
      if (token.type === 'scene-heading') {
        sceneNumber++;
        scenes.push({
          number: sceneNumber,
          heading: trimmed,
          startToken: tokens.length,
        });
      }

      tokens.push(token);
      prevType = token.type;
    }

    return tokens;
  }

  /**
   * Detect element type for a single line
   */
  private static detectElement(
    trimmed: string,
    raw: string,
    prevLine: string,
    nextLine: string,
    previousType: ElementType | null
  ): FountainToken {
    // Forced scene heading
    if (PATTERNS.forcedSceneHeading.test(trimmed)) {
      return {
        type: 'scene-heading',
        text: trimmed.substring(1).trim().toUpperCase(),
        raw,
      };
    }

    // Scene heading
    if (PATTERNS.sceneHeading.test(trimmed)) {
      return {
        type: 'scene-heading',
        text: trimmed.toUpperCase(),
        raw,
      };
    }

    // Forced transition
    if (PATTERNS.forcedTransition.test(trimmed)) {
      return {
        type: 'transition',
        text: trimmed.substring(1).trim().toUpperCase(),
        raw,
      };
    }

    // Transition (must end with TO: and be all caps)
    if (PATTERNS.transition.test(trimmed)) {
      return {
        type: 'transition',
        text: trimmed.toUpperCase(),
        raw,
      };
    }

    // Centered text
    if (PATTERNS.centered.test(trimmed)) {
      return {
        type: 'centered',
        text: trimmed.slice(1, -1).trim(),
        raw,
      };
    }

    // Parenthetical
    if (PATTERNS.parenthetical.test(trimmed) && 
        (previousType === 'character' || previousType === 'dialogue')) {
      return {
        type: 'parenthetical',
        text: trimmed,
        raw,
      };
    }

    // Character detection (more strict)
    if (this.isCharacterName(trimmed, prevLine, nextLine, previousType)) {
      return {
        type: 'character',
        text: trimmed,
        raw,
      };
    }

    // Dialogue: follows character or parenthetical
    if (previousType === 'character' || previousType === 'parenthetical') {
      return {
        type: 'dialogue',
        text: trimmed,
        raw,
      };
    }

    // Default to action
    return {
      type: 'action',
      text: trimmed,
      raw,
    };
  }

  /**
   * Check if a line is a character name
   */
  private static isCharacterName(
    text: string,
    prevLine: string,
    nextLine: string,
    _previousType: ElementType | null  // Unused but kept for API consistency
  ): boolean {
    // Must not be empty
    if (!text) return false;

    // Strip any forced character marker (^)
    const cleanText = text.replace(/^\^/, '').trim();
    
    // Remove parenthetical extensions for checking
    const nameOnly = cleanText.replace(/\s*\([^)]+\)\s*$/, '').trim();
    
    // Must be all uppercase
    if (nameOnly !== nameOnly.toUpperCase()) return false;
    
    // Must have at least one letter
    if (!/[A-Z]/.test(nameOnly)) return false;
    
    // Must be reasonable length (character names are short)
    if (nameOnly.length < 2 || nameOnly.length > 40) return false;
    
    // Must not be in the NOT_CHARACTERS list
    if (NOT_CHARACTERS.has(nameOnly)) return false;
    
    // Must not be a scene heading
    if (PATTERNS.sceneHeading.test(cleanText)) return false;
    
    // Must not be a transition
    if (PATTERNS.transition.test(cleanText)) return false;
    
    // Previous line should be blank (or scene heading, or we're at start)
    // This is a key differentiator from action lines in all caps
    const isAfterBlank = prevLine === '';
    const isAfterSceneHeading = PATTERNS.sceneHeading.test(prevLine);
    const isAfterTransition = PATTERNS.transition.test(prevLine);
    
    // Next line should NOT be blank if this is a character (dialogue follows)
    const nextLineHasContent = nextLine !== '' && !PATTERNS.sceneHeading.test(nextLine);
    
    // Character cues must be preceded by blank line and followed by dialogue
    if (!isAfterBlank && !isAfterSceneHeading && !isAfterTransition) {
      return false;
    }
    
    // If there's a forced character marker, accept it
    if (text.startsWith('^')) return true;
    
    // Otherwise, trust the pattern for typical character names
    return PATTERNS.character.test(cleanText) && nextLineHasContent;
  }

  /**
   * Extract clean character name from line
   */
  private static extractCharacterName(line: string): string {
    let name = line.trim();
    
    // Remove forced character marker
    name = name.replace(/^\^/, '');
    
    // Remove parenthetical extensions
    name = name.replace(/\s*\([^)]+\)\s*$/, '');
    
    // Remove trailing numbers (JOHN 2)
    name = name.replace(/\s+\d+$/, '');
    
    return name.trim();
  }

  /**
   * Normalize content - collapse excessive blank lines, standardize formatting
   */
  static normalizeContent(content: string): string {
    // Normalize line endings
    let normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Collapse 3+ consecutive blank lines to 2
    normalized = normalized.replace(/\n{3,}/g, '\n\n');
    
    // Remove trailing whitespace from lines
    normalized = normalized.split('\n').map(line => line.trimEnd()).join('\n');
    
    // Trim leading/trailing whitespace from entire document
    normalized = normalized.trim();
    
    // Ensure single newline at end
    normalized += '\n';
    
    return normalized;
  }

  /**
   * Convert tokens back to Fountain text
   */
  static tokensToText(tokens: FountainToken[]): string {
    return tokens.map(t => t.text).join('\n');
  }

  /**
   * Get unique characters from content
   */
  static extractCharacters(content: string): string[] {
    const parsed = this.parse(content);
    return Array.from(parsed.characters).sort();
  }

  /**
   * Get scene list from content
   */
  static extractScenes(content: string): Array<{ number: number; heading: string }> {
    const parsed = this.parse(content);
    return parsed.scenes.map(s => ({
      number: s.number,
      heading: s.heading,
    }));
  }
}

