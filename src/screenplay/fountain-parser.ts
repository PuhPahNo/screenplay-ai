import type { Scene, ParsedScreenplay } from '../shared/types';
import { v4 as uuidv4 } from 'uuid';

export class FountainParser {
  static parse(content: string): ParsedScreenplay {
    const lines = content.split('\n');
    const scenes: Scene[] = [];
    const characters = new Set<string>();
    let title: string | undefined;
    let author: string | undefined;
    
    let currentScene: Partial<Scene> | null = null;
    let sceneNumber = 0;
    let currentSceneContent: string[] = [];
    let currentSceneCharacters = new Set<string>();
    let lineNumber = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      lineNumber = i;
      
      // Parse title page
      if (line.startsWith('Title:')) {
        title = line.substring(6).trim();
        continue;
      }
      if (line.startsWith('Author:')) {
        author = line.substring(7).trim();
        continue;
      }
      
      // Scene heading (INT./EXT. or I/E)
      if (this.isSceneHeading(line)) {
        // Save previous scene if exists
        if (currentScene) {
          currentScene.content = currentSceneContent.join('\n');
          currentScene.characters = Array.from(currentSceneCharacters);
          currentScene.endLine = lineNumber - 1;
          scenes.push(currentScene as Scene);
        }
        
        // Start new scene
        sceneNumber++;
        const { location, timeOfDay } = this.parseSceneHeading(line);
        
        currentScene = {
          id: uuidv4(),
          number: sceneNumber,
          heading: line.trim(),
          location,
          timeOfDay,
          summary: '',
          characters: [],
          startLine: lineNumber,
          endLine: lineNumber,
          content: '',
        };
        
        currentSceneContent = [];
        currentSceneCharacters = new Set();
        continue;
      }
      
      // Character name (all caps, possibly with extension)
      if (currentScene && this.isCharacterName(line)) {
        const charName = this.extractCharacterName(line);
        currentSceneCharacters.add(charName);
        characters.add(charName);
      }
      
      // Add to current scene content
      if (currentScene) {
        currentSceneContent.push(line);
      }
    }
    
    // Save last scene
    if (currentScene) {
      currentScene.content = currentSceneContent.join('\n');
      currentScene.characters = Array.from(currentSceneCharacters);
      currentScene.endLine = lineNumber;
      scenes.push(currentScene as Scene);
    }
    
    return {
      scenes,
      characters,
      title,
      author,
    };
  }
  
  private static isSceneHeading(line: string): boolean {
    const trimmed = line.trim();
    
    // Check for standard scene headings
    const sceneHeadingPattern = /^(INT|EXT|INT\.\/EXT|INT\/EXT|I\/E)[\.\s]/i;
    return sceneHeadingPattern.test(trimmed);
  }
  
  private static parseSceneHeading(line: string): { location: string; timeOfDay: string } {
    const trimmed = line.trim();
    
    // Remove the INT/EXT prefix
    const withoutPrefix = trimmed.replace(/^(INT|EXT|INT\.\/EXT|INT\/EXT|I\/E)[\.\s]*/i, '');
    
    // Split by dash or hyphen to separate location and time
    const parts = withoutPrefix.split(/\s*[-–—]\s*/);
    
    let location = parts[0]?.trim() || '';
    let timeOfDay = parts[1]?.trim() || '';
    
    return { location, timeOfDay };
  }
  
  private static isCharacterName(line: string): boolean {
    const trimmed = line.trim();
    
    // Must be all caps and not empty
    if (!trimmed || trimmed !== trimmed.toUpperCase()) {
      return false;
    }
    
    // Must not be a scene heading
    if (this.isSceneHeading(trimmed)) {
      return false;
    }
    
    // Must not be a transition (ends with TO: or contains FADE, CUT, etc.)
    if (trimmed.endsWith('TO:') || 
        trimmed.endsWith('.') ||
        trimmed.match(/^(FADE|CUT|DISSOLVE|WIPE|SMASH CUT)/)) {
      return false;
    }
    
    // Must not be centered text (wrapped in > <)
    if (trimmed.startsWith('>') || trimmed.endsWith('<')) {
      return false;
    }
    
    // Must not be page break indicators
    if (trimmed.match(/^(PAGE|ACT|SCENE)\s+\d+/)) {
      return false;
    }
    
    // Reasonable length for character name (not full sentences)
    if (trimmed.length > 40 || trimmed.length < 2) {
      return false;
    }
    
    // Must not contain lowercase letters (already checked above but being explicit)
    // Must contain at least one letter
    if (!/[A-Z]/.test(trimmed)) {
      return false;
    }
    
    // Common non-character patterns
    if (trimmed === 'THE END' || trimmed === 'CONTINUED' || trimmed === 'MORE') {
      return false;
    }
    
    return true;
  }
  
  private static extractCharacterName(line: string): string {
    let name = line.trim();
    
    // Remove parenthetical extensions like (V.O.) or (O.S.)
    name = name.replace(/\s*\([^)]*\)\s*$/, '');
    
    // Remove character number/extension (e.g., "2" in "JOHN 2")
    name = name.replace(/\s+\d+$/, '');
    
    return name.trim();
  }
  
  // Helper method to format screenplay for export
  static format(content: string): string {
    const lines = content.split('\n');
    const formatted: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (this.isSceneHeading(trimmed)) {
        formatted.push('');
        formatted.push(trimmed.toUpperCase());
        formatted.push('');
      } else if (this.isCharacterName(trimmed)) {
        formatted.push('');
        formatted.push(trimmed);
      } else if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
        // Parenthetical
        formatted.push(trimmed);
      } else if (trimmed.endsWith('TO:')) {
        // Transition
        formatted.push('');
        formatted.push(trimmed);
        formatted.push('');
      } else {
        formatted.push(trimmed);
      }
    }
    
    return formatted.join('\n');
  }
}

