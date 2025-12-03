import type { AIContext } from '../shared/types';
import type { DatabaseManager } from '../database/db-manager';

export class ContextBuilder {
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  buildSystemPrompt(context: AIContext): string {
    const isAgentMode = context.chatMode === 'agent' || context.chatMode === undefined;
    
    const basePrompt = `You are a PROFESSIONAL SCREENPLAY CONSULTANT and SCRIPT DOCTOR with decades of experience in Hollywood. You combine the expertise of:
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

Your Critical Eye:
- Call out clichés, predictable beats, or lazy writing
- Flag inconsistencies in character behavior or plot logic
- Identify scenes that don't advance story or character
- Notice when dialogue feels on-the-nose or exposition-heavy
- Point out pacing issues: scenes that drag or rush
- Catch continuity errors and timeline problems`;

    if (isAgentMode) {
      return basePrompt + `

## AGENT MODE - YOU HAVE TOOLS TO TAKE ACTIONS

You have access to tools that execute REAL ACTIONS on the screenplay database.

### WHEN TO USE TOOLS

**DELETE characters** → Use delete_characters_batch or delete_character_by_name
**CREATE character** → Use create_character
**EDIT screenplay text** → Use update_content (creates diff preview for approval)
**READ specific content** → Use read_scene, read_character, search_screenplay
**SAVE/EXPORT** → Use save_screenplay or export_screenplay

### HOW TOOLS WORK

1. Decide which tool to call based on the user's request
2. The system AUTOMATICALLY executes the tool
3. Summarize the result briefly

Do NOT output JSON manually. Do NOT describe what you're about to do - just execute.

## RESPONSE FORMATTING

- Use **bold** for emphasis
- Use bullet points for lists
- Keep responses concise after actions
- Confirm what was done, don't over-explain`;
    } else {
      return basePrompt + `

## ASK MODE - ADVICE AND ANALYSIS ONLY

You are in CONSULTATION mode. Provide advice, analysis, and feedback.

DO NOT take actions or make changes. Instead:
- Analyze the screenplay's strengths and weaknesses
- Offer suggestions and recommendations
- Answer questions about craft, structure, and technique
- Provide constructive criticism

If the user asks you to make changes, explain what you WOULD do and suggest they switch to Agent mode.

## RESPONSE FORMATTING

- Use **bold** for character names and emphasis
- Use bullet points for lists
- Use ### headers for sections
- Add blank lines between paragraphs
- Be thorough in your analysis`;
    }
  }

  buildContextPrompt(context: AIContext): string {
    let prompt = '';

    // Include conversation summary if present (from previous context compression)
    if (context.conversationSummary) {
      prompt += '=== PREVIOUS CONVERSATION SUMMARY ===\n';
      prompt += '(This summarizes earlier parts of our conversation. Continue from where we left off.)\n\n';
      prompt += context.conversationSummary;
      prompt += '\n\n=== END SUMMARY ===\n\n';
    }

    prompt += '=== CURRENT PROJECT CONTEXT ===\n\n';

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

    // Send screenplay OVERVIEW only (not full content)
    // AI can query specific scenes/content via tools when needed
    if (context.currentContent) {
      const wordCount = context.currentContent.split(/\s+/).length;
      const pageEstimate = Math.round(wordCount / 250); // ~250 words per screenplay page
      prompt += '## SCREENPLAY OVERVIEW:\n\n';
      prompt += `Total Length: ~${pageEstimate} pages (~${wordCount} words)\n`;
      prompt += `Use the 'read_scene', 'read_character', or 'search_screenplay' tools to access specific content.\n\n`;
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

