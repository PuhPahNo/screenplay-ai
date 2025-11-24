import type { ElementType } from '../shared/types';

export interface FormattingResult {
  type: ElementType;
  text: string;
  shouldCapitalize?: boolean;
}

/**
 * Auto-formatter for Fountain screenplay format
 * Determines element types based on content and context
 */
export class AutoFormatter {
  /**
   * Detect element type based on text content and previous element
   */
  static detectElementType(
    text: string,
    previousElement?: ElementType
  ): ElementType {
    const trimmed = text.trim();
    
    if (!trimmed) {
      return 'action';
    }

    // Scene Heading: Starts with INT., EXT., INT./EXT., I/E
    if (/^(INT\.|EXT\.|INT\.?\/EXT\.|I\/E)/i.test(trimmed)) {
      return 'scene-heading';
    }

    // Transition: Ends with TO:
    if (/TO:\s*$/.test(trimmed)) {
      return 'transition';
    }

    // Centered: Starts with > and ends with <
    if (/^>.*<$/.test(trimmed)) {
      return 'centered';
    }

    // Parenthetical: Enclosed in parentheses
    if (/^\(.*\)$/.test(trimmed)) {
      return 'parenthetical';
    }

    // Character: ALL CAPS after action or scene heading (not after character/dialogue)
    if (
      this.isAllCaps(trimmed) &&
      previousElement !== 'character' &&
      previousElement !== 'dialogue' &&
      previousElement !== 'parenthetical'
    ) {
      return 'character';
    }

    // Dialogue: Comes after character or parenthetical
    if (
      previousElement === 'character' ||
      previousElement === 'parenthetical'
    ) {
      return 'dialogue';
    }

    // Default to action
    return 'action';
  }

  /**
   * Format text according to element type
   */
  static formatElement(text: string, type: ElementType): string {
    const trimmed = text.trim();

    switch (type) {
      case 'scene-heading':
        return trimmed.toUpperCase();

      case 'character':
        return trimmed.toUpperCase();

      case 'transition':
        return trimmed.toUpperCase();

      case 'centered':
        // Remove > < markers
        return trimmed.replace(/^>|<$/g, '').trim().toUpperCase();

      case 'parenthetical':
        // Ensure parentheses
        if (!trimmed.startsWith('(')) {
          return `(${trimmed}${trimmed.endsWith(')') ? '' : ')'})`;
        }
        return trimmed;

      case 'dialogue':
      case 'action':
      default:
        return trimmed;
    }
  }

  /**
   * Check if text is all uppercase (allowing for punctuation and spaces)
   */
  static isAllCaps(text: string): boolean {
    // Remove punctuation, numbers, and whitespace
    const letters = text.replace(/[^a-zA-Z]/g, '');
    
    if (letters.length === 0) {
      return false;
    }

    // Check if all letters are uppercase
    return letters === letters.toUpperCase();
  }

  /**
   * Get the next expected element type based on current type
   */
  static getNextElementType(currentType: ElementType): ElementType {
    switch (currentType) {
      case 'scene-heading':
        return 'action';

      case 'character':
        return 'dialogue';

      case 'parenthetical':
        return 'dialogue';

      case 'dialogue':
        return 'action';

      case 'transition':
        return 'scene-heading';

      case 'centered':
      case 'action':
      default:
        return 'action';
    }
  }

  /**
   * Parse Fountain content into formatted elements
   */
  static parseFountain(content: string): FormattingResult[] {
    const lines = content.split('\n');
    const results: FormattingResult[] = [];
    let previousType: ElementType | undefined;

    for (const line of lines) {
      const type = this.detectElementType(line, previousType);
      const formatted = this.formatElement(line, type);

      results.push({
        type,
        text: formatted,
      });

      previousType = type;
    }

    return results;
  }

  /**
   * Get indentation and styling for element type
   */
  static getElementStyle(type: ElementType): {
    marginLeft: string;
    maxWidth?: string;
    fontWeight?: string;
    textTransform?: string;
    textAlign?: string;
  } {
    switch (type) {
      case 'scene-heading':
        return {
          marginLeft: '0',
          fontWeight: 'bold',
          textTransform: 'uppercase',
        };

      case 'character':
        return {
          marginLeft: '2.2in',
          fontWeight: 'bold',
          textTransform: 'uppercase',
        };

      case 'dialogue':
        return {
          marginLeft: '1.5in',
          maxWidth: '3.5in',
        };

      case 'parenthetical':
        return {
          marginLeft: '1.8in',
        };

      case 'transition':
        return {
          marginLeft: '4in',
          fontWeight: 'bold',
          textTransform: 'uppercase',
        };

      case 'centered':
        return {
          marginLeft: '0',
          textAlign: 'center',
          textTransform: 'uppercase',
        };

      case 'action':
      default:
        return {
          marginLeft: '0',
          maxWidth: '6in',
        };
    }
  }

  /**
   * Calculate page breaks based on line count
   * Standard screenplay: 55 lines per page
   */
  static calculatePageBreaks(elements: FormattingResult[]): number[] {
    const LINES_PER_PAGE = 55;
    const pageBreaks: number[] = [];
    let currentLine = 0;

    elements.forEach((element, index) => {
      const lineHeight = this.getElementLineHeight(element.type);
      currentLine += lineHeight;

      if (currentLine >= LINES_PER_PAGE) {
        pageBreaks.push(index);
        currentLine = 0;
      }
    });

    return pageBreaks;
  }

  /**
   * Get approximate line height for element type
   */
  private static getElementLineHeight(type: ElementType): number {
    switch (type) {
      case 'scene-heading':
        return 3; // 2em top margin + 1em bottom

      case 'character':
        return 2; // 1em top margin + 1 line

      case 'transition':
        return 2;

      case 'dialogue':
      case 'action':
      case 'parenthetical':
      case 'centered':
      default:
        return 1;
    }
  }
}

