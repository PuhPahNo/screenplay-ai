import type { AIContext } from '../shared/types';
import type { DatabaseManager } from '../database/db-manager';

export class ContextBuilder {
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  buildSystemPrompt(_context: AIContext): string {
    return `You are an expert AI assistant for professional screenplay writers. You have deep knowledge of:
- Story structure (three-act structure, Hero's Journey, etc.)
- Character development and arcs
- Dialogue writing
- Scene construction and pacing
- Industry-standard screenplay formatting
- Dramatic techniques and storytelling principles

Your role is to help writers:
1. Develop compelling characters with consistent voices and clear arcs
2. Structure their narratives effectively
3. Write authentic, purposeful dialogue
4. Maintain continuity and consistency
5. Identify pacing and structural issues
6. Generate creative ideas that serve the story

IMPORTANT: You have access to tools for creating/modifying characters and scenes.
- If the user asks to CREATE, ADD, DELETE, or UPDATE a character or scene, you MUST use the provided tools.
- Do NOT just describe what you would do. ACTUALLY DO IT using the tools.
- For example, if the user says "Create a character named John", call the 'create_character' tool.
- If the user says "Add a scene at the coffee shop", call the 'add_scene' tool.

Always reference the specific project context when providing advice. Be constructive, insightful, and specific in your responses.`;
  }

  buildContextPrompt(context: AIContext): string {
    let prompt = '=== CURRENT PROJECT CONTEXT ===\n\n';

    // Add characters
    if (context.characters && context.characters.length > 0) {
      prompt += '## CHARACTERS:\n\n';
      for (const char of context.characters) {
        prompt += `**${char.name}**\n`;
        if (char.description) {
          prompt += `Description: ${char.description}\n`;
        }
        if (char.arc) {
          prompt += `Arc: ${char.arc}\n`;
        }
        if (char.appearances.length > 0) {
          prompt += `Appears in ${char.appearances.length} scene(s)\n`;
        }
        if (char.relationships && Object.keys(char.relationships).length > 0) {
          prompt += 'Relationships:\n';
          for (const [relName, relDesc] of Object.entries(char.relationships)) {
            prompt += `- ${relName}: ${relDesc}\n`;
          }
        }
        prompt += '\n';
      }
    }

    // Add scenes
    if (context.scenes && context.scenes.length > 0) {
      prompt += '## SCENES:\n\n';
      for (const scene of context.scenes.slice(0, 10)) {
        // Limit to first 10 scenes to avoid token limits
        prompt += `Scene ${scene.number}: ${scene.heading}\n`;
        if (scene.summary) {
          prompt += `Summary: ${scene.summary}\n`;
        }
        if (scene.characters.length > 0) {
          prompt += `Characters: ${scene.characters.join(', ')}\n`;
        }
        prompt += '\n';
      }
      if (context.scenes.length > 10) {
        prompt += `... and ${context.scenes.length - 10} more scenes\n\n`;
      }
    }

    // Add storyline
    if (context.storyline) {
      prompt += '## STORYLINE:\n\n';
      if (context.storyline.narrativeStructure) {
        prompt += `Structure: ${context.storyline.narrativeStructure}\n\n`;
      }
      if (context.storyline.themes && context.storyline.themes.length > 0) {
        prompt += `Themes: ${context.storyline.themes.join(', ')}\n\n`;
      }
      if (context.storyline.plotPoints && context.storyline.plotPoints.length > 0) {
        prompt += 'Plot Points:\n';
        for (const point of context.storyline.plotPoints) {
          prompt += `- ${point.name}: ${point.description}\n`;
        }
        prompt += '\n';
      }
    }

    // Add current screenplay content (limited)
    if (context.currentContent) {
      const contentPreview = context.currentContent.substring(0, 2000);
      prompt += '## CURRENT SCREENPLAY EXCERPT:\n\n';
      prompt += contentPreview;
      if (context.currentContent.length > 2000) {
        prompt += '\n\n... (content truncated)';
      }
      prompt += '\n\n';
    }

    prompt += '=== END CONTEXT ===\n\n';

    return prompt;
  }

  async buildContextForScene(sceneId: string): Promise<AIContext> {
    const scene = await this.dbManager.getScene(sceneId);
    if (!scene) {
      throw new Error('Scene not found');
    }

    const characters = await this.dbManager.getCharacters();
    const sceneCharacters = characters.filter((c) => scene.characters.includes(c.id));

    // const allScenes = await this.dbManager.getScenes();
    const storyline = await this.dbManager.getStoryline();

    return {
      characters: sceneCharacters,
      scenes: [scene],
      storyline: storyline || undefined,
      currentContent: scene.content,
    };
  }

  async buildContextForCharacter(characterId: string): Promise<AIContext> {
    const character = await this.dbManager.getCharacter(characterId);
    if (!character) {
      throw new Error('Character not found');
    }

    const scenes = await this.dbManager.getScenes();
    const characterScenes = scenes.filter((s) => s.characters.includes(characterId));

    const storyline = await this.dbManager.getStoryline();

    return {
      characters: [character],
      scenes: characterScenes,
      storyline: storyline || undefined,
      currentContent: '',
    };
  }

  async buildFullContext(): Promise<AIContext> {
    const characters = await this.dbManager.getCharacters();
    const scenes = await this.dbManager.getScenes();
    const storyline = await this.dbManager.getStoryline();

    // Build current content from scenes
    const currentContent = scenes.map((s) => s.content).join('\n\n');

    return {
      characters,
      scenes,
      storyline: storyline || undefined,
      currentContent,
    };
  }
}

