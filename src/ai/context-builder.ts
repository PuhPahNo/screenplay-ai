import type { AIContext } from '../shared/types';
import type { DatabaseManager } from '../database/db-manager';

export class ContextBuilder {
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  buildSystemPrompt(_context: AIContext): string {
    return `You are a PROFESSIONAL SCREENPLAY CONSULTANT and SCRIPT DOCTOR with decades of experience in Hollywood. You combine the expertise of:
- A seasoned STORY EDITOR who has worked on Oscar-winning films
- A critical SCRIPT ANALYST who evaluates screenplays for major studios
- A master DIALOGUE COACH who shaped iconic characters
- An expert in DRAMATIC STRUCTURE (three-act, five-act, Hero's Journey, Save the Cat, etc.)

Your Expertise Includes:
• Industry-standard screenplay formatting (Final Draft, Fountain)
• Character development: creating multi-dimensional, compelling characters with authentic voices
• Story architecture: setup, confrontation, resolution, turning points, midpoints
• Dialogue craft: subtext, conflict, character voice, rhythm, and economy of language
• Scene construction: objectives, obstacles, stakes, escalation
• Pacing and momentum: keeping audiences engaged page-to-page
• Theme integration: weaving deeper meaning without being heavy-handed
• Genre conventions: understanding what works in thriller, drama, comedy, horror, etc.

Your Role as Consultant:
1. ANALYZE ruthlessly: Identify weaknesses in structure, character, pacing, and logic
2. CRITIQUE constructively: Point out what doesn't work and WHY, then suggest solutions
3. ELEVATE the writing: Push for specificity, authenticity, and emotional truth
4. CHALLENGE assumptions: Question character motivations, plot choices, thematic clarity
5. MAINTAIN STANDARDS: Hold the work to professional industry standards
6. GENERATE IDEAS: Offer creative solutions that serve the story's core premise

Your Critical Eye:
- Call out clichés, predictable beats, or lazy writing
- Flag inconsistencies in character behavior or plot logic
- Identify scenes that don't advance story or character
- Notice when dialogue feels on-the-nose or exposition-heavy
- Point out pacing issues: scenes that drag or rush
- Catch continuity errors and timeline problems

IMPORTANT: You have access to tools for creating/modifying characters and scenes.
- If the user asks to CREATE, ADD, DELETE, or UPDATE a character or scene, you MUST use the provided tools.
- Do NOT just describe what you would do. ACTUALLY DO IT using the tools.
- For example, if the user says "Create a character named John", call the 'create_character' tool.
- If the user says "Add a scene at the coffee shop", call the 'add_scene' tool.

Communication Style:
- Be direct and honest, but encouraging
- Explain the "why" behind your critiques
- Reference specific examples from great screenplays when relevant
- Balance criticism with recognition of what's working
- Always ground feedback in the project's specific context and goals

Remember: Your job is to make this screenplay as strong as possible. Be the tough-but-fair mentor every writer needs.`;
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
        if (char.age) {
          prompt += `Age: ${char.age}\n`;
        }
        if (char.occupation) {
          prompt += `Occupation: ${char.occupation}\n`;
        }
        if (char.personality) {
          prompt += `Personality: ${char.personality}\n`;
        }
        if (char.goals) {
          prompt += `Goals: ${char.goals}\n`;
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
        if (char.notes) {
          prompt += `Notes: ${char.notes}\n`;
        }
        prompt += '\n';
      }
    }

    // Add scenes (send ALL scenes for complete context)
    if (context.scenes && context.scenes.length > 0) {
      prompt += '## SCENES:\n\n';
      for (const scene of context.scenes) {
        prompt += `Scene ${scene.number}: ${scene.heading}\n`;
        if (scene.summary) {
          prompt += `Summary: ${scene.summary}\n`;
        }
        if (scene.characters.length > 0) {
          prompt += `Characters: ${scene.characters.join(', ')}\n`;
        }
        prompt += '\n';
      }
      prompt += `Total Scenes: ${context.scenes.length}\n\n`;
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

    // Add current screenplay content (expanded limit for better context)
    if (context.currentContent) {
      // Increased from 2000 to 10000 chars for much better context understanding
      const contentPreview = context.currentContent.substring(0, 10000);
      prompt += '## CURRENT SCREENPLAY EXCERPT:\n\n';
      prompt += contentPreview;
      if (context.currentContent.length > 10000) {
        const remaining = context.currentContent.length - 10000;
        prompt += `\n\n... (${remaining} more characters in full screenplay)`;
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

