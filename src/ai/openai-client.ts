import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import type { AIContext, Storyline, SystemActions, TokenUsage } from '../shared/types';
import type { DatabaseManager } from '../database/db-manager';
import { ContextBuilder } from './context-builder';

export interface ChatResponse {
  content: string;
  tokenUsage: TokenUsage;
}

export class AIClient {
  private openai: OpenAI;
  private dbManager: DatabaseManager;
  private contextBuilder: ContextBuilder;
  private systemActions?: SystemActions;

  constructor(apiKey: string, dbManager: DatabaseManager, systemActions?: SystemActions) {
    this.openai = new OpenAI({ apiKey });
    this.dbManager = dbManager;
    this.contextBuilder = new ContextBuilder(dbManager);
    this.systemActions = systemActions;
  }

  async chat(message: string, context: AIContext): Promise<ChatResponse> {
    try {
      const systemPrompt = this.contextBuilder.buildSystemPrompt(context);
      const contextPrompt = this.contextBuilder.buildContextPrompt(context);

      // Track token usage across all API calls
      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;

      const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
        {
          type: 'function',
          function: {
            name: 'create_character',
            description: 'Create a new CHARACTER in the database. ONLY use for actual speaking characters with names like JOHN, SARAH, DR. SMITH. Do NOT use for scene headings (INT./EXT.), transitions (CUT TO), or action descriptions.',
            parameters: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Character name in UPPERCASE (e.g. JOHN, SARAH). NOT scene headings like INT. or EXT.' },
                description: { type: 'string', description: 'Brief description of the character' },
                age: { type: 'string', description: 'Age of the character' },
                occupation: { type: 'string', description: 'Occupation of the character' },
                personality: { type: 'string', description: 'Personality traits' },
                goals: { type: 'string', description: 'Character goals' },
                role: { type: 'string', description: 'Role in the story (Protagonist, Antagonist, etc.)' }
              },
              required: ['name']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'edit_character',
            description: 'Update an existing character in the database.',
            parameters: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'ID of the character to update' },
                name: { type: 'string', description: 'New name (optional)' },
                description: { type: 'string', description: 'New description (optional)' },
                notes: { type: 'string', description: 'New notes (optional)' }
              },
              required: ['id']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'delete_character',
            description: 'Delete a character from the database by ID.',
            parameters: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'ID of the character to delete' }
              },
              required: ['id']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'delete_character_by_name',
            description: 'Delete a character from the database by name. Use this when the user asks to delete a character by name.',
            parameters: {
              type: 'object',
              properties: {
                character_name: { type: 'string', description: 'Name of the character to delete (case-insensitive)' }
              },
              required: ['character_name']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'delete_characters_batch',
            description: 'Delete multiple characters at once by name. Use this when the user asks to delete multiple characters.',
            parameters: {
              type: 'object',
              properties: {
                character_names: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of character names to delete'
                }
              },
              required: ['character_names']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'add_scene',
            description: 'Add a new scene to the screenplay. Include the line_number where the scene heading appears in the screenplay text.',
            parameters: {
              type: 'object',
              properties: {
                heading: { type: 'string', description: 'Scene heading (e.g. INT. OFFICE - DAY)' },
                summary: { type: 'string', description: 'Brief summary of the scene' },
                characters: { type: 'array', items: { type: 'string' }, description: 'List of character names in the scene' },
                line_number: { type: 'number', description: 'The line number in the screenplay where this scene heading appears (for anchoring/navigation)' }
              },
              required: ['heading']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'delete_scene',
            description: 'Delete a scene from the screenplay.',
            parameters: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'ID of the scene to delete' }
              },
              required: ['id']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'save_screenplay',
            description: 'Save the current screenplay to disk.',
            parameters: {
              type: 'object',
              properties: {},
              required: []
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'export_screenplay',
            description: 'Export the screenplay to PDF or FDX.',
            parameters: {
              type: 'object',
              properties: {
                format: { type: 'string', enum: ['pdf', 'fdx'], description: 'Format to export' }
              },
              required: ['format']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'update_content',
            description: 'Propose changes to the screenplay content. Use this when the user asks to rewrite, edit, or change the text of the screenplay.',
            parameters: {
              type: 'object',
              properties: {
                original_text: { type: 'string', description: 'The exact text segment to be replaced. Must match existing content exactly.' },
                new_text: { type: 'string', description: 'The new text to replace the original with.' },
                description: { type: 'string', description: 'A brief description of what this change does (e.g. "Rewrote scene to be more intense")' }
              },
              required: ['original_text', 'new_text', 'description']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'set_screenplay_metadata',
            description: 'Set the screenplay title and/or author. Use this when you detect title page information like "written by", "Author:", or similar.',
            parameters: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'The screenplay title (optional)' },
                author: { type: 'string', description: 'The author name (optional)' }
              },
              required: []
            }
          }
        },
        // === QUERY TOOLS (Read-only access to screenplay data) ===
        {
          type: 'function',
          function: {
            name: 'read_scene',
            description: 'Read the FULL content of a specific scene. Use this to analyze dialogue, action lines, or specific scene details. You can identify scenes from the scene list in the context.',
            parameters: {
              type: 'object',
              properties: {
                scene_id: { type: 'string', description: 'The ID of the scene to read' },
                scene_number: { type: 'number', description: 'Alternatively, the scene number (1, 2, 3, etc.)' }
              },
              required: []
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'read_character',
            description: 'Read ALL details about a specific character including relationships, appearances, backstory, and notes.',
            parameters: {
              type: 'object',
              properties: {
                character_id: { type: 'string', description: 'The ID of the character' },
                character_name: { type: 'string', description: 'Alternatively, the character name (case-insensitive)' }
              },
              required: []
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'search_screenplay',
            description: 'Search the entire screenplay for specific text, dialogue, or keywords. Returns matching scenes with context.',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'The text to search for (case-insensitive)' }
              },
              required: ['query']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'link_character_to_scene',
            description: 'Link a character to a scene they appear in. Updates both the character\'s appearances and the scene\'s character list.',
            parameters: {
              type: 'object',
              properties: {
                character_name: { type: 'string', description: 'The character name (case-insensitive)' },
                scene_number: { type: 'number', description: 'The scene number where this character appears' }
              },
              required: ['character_name', 'scene_number']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'merge_characters',
            description: 'Merge duplicate/variant character names into one canonical name. Use this when you find the same character referred to by different names (e.g., "HENRY" and "HENRY MARCHETTI", or "O\'KEEFE" and "O\'KEEFFE").',
            parameters: {
              type: 'object',
              properties: {
                keep_name: { type: 'string', description: 'The canonical character name to KEEP' },
                merge_names: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of variant names to merge INTO the keep_name (these will be deleted)'
                },
                reason: { type: 'string', description: 'Why these are the same character' }
              },
              required: ['keep_name', 'merge_names']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'get_character_scenes',
            description: 'Get all scenes where a specific character appears, with full scene content.',
            parameters: {
              type: 'object',
              properties: {
                character_name: { type: 'string', description: 'The character name to find scenes for' }
              },
              required: ['character_name']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'get_screenplay_section',
            description: 'Read a section of the screenplay by page range or scene range.',
            parameters: {
              type: 'object',
              properties: {
                start_scene: { type: 'number', description: 'Starting scene number' },
                end_scene: { type: 'number', description: 'Ending scene number' }
              },
              required: ['start_scene', 'end_scene']
            }
          }
        },
        // === FULL CONTENT ACCESS TOOLS ===
        {
          type: 'function',
          function: {
            name: 'read_full_screenplay',
            description: 'Read the ENTIRE screenplay content. Use this when you need to analyze the full text, search for specific events, deaths, plot points, or answer questions that require seeing the whole script. WARNING: This returns a lot of text.',
            parameters: {
              type: 'object',
              properties: {},
              required: []
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'read_scene_with_context',
            description: 'Read a scene along with the scenes before and after it for full context. Use this to understand what leads into a scene and what follows.',
            parameters: {
              type: 'object',
              properties: {
                scene_number: { type: 'number', description: 'The scene number to read' },
                context_scenes: { type: 'number', description: 'Number of scenes before and after to include (default 1)' }
              },
              required: ['scene_number']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'analyze_character_arc',
            description: 'Analyze how a character develops across the screenplay. Shows their appearances, dialogue moments, and progression through the story.',
            parameters: {
              type: 'object',
              properties: {
                character_name: { type: 'string', description: 'Name of the character to analyze' }
              },
              required: ['character_name']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'find_character_dialogue',
            description: 'Find all dialogue spoken by a specific character throughout the screenplay.',
            parameters: {
              type: 'object',
              properties: {
                character_name: { type: 'string', description: 'Name of the character' }
              },
              required: ['character_name']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'analyze_scene_characters',
            description: 'Analyze all characters in a specific scene - their dialogue, actions, and interactions.',
            parameters: {
              type: 'object',
              properties: {
                scene_number: { type: 'number', description: 'The scene number to analyze' }
              },
              required: ['scene_number']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'find_plot_events',
            description: 'Search for significant plot events like deaths, revelations, confrontations, or turning points in the screenplay.',
            parameters: {
              type: 'object',
              properties: {
                event_type: { type: 'string', description: 'Type of event to search for (e.g., "death", "fight", "kiss", "reveal", "confrontation")' }
              },
              required: ['event_type']
            }
          }
        },
        // === LIST/OVERVIEW TOOLS ===
        {
          type: 'function',
          function: {
            name: 'list_all_characters',
            description: 'Get a list of ALL characters currently in the database with their scene counts. Use this to see what characters exist before creating new ones or to find duplicates.',
            parameters: {
              type: 'object',
              properties: {},
              required: []
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'list_all_scenes',
            description: 'Get a list of ALL scenes currently in the database with their numbers and headings. Use this to see what scenes exist.',
            parameters: {
              type: 'object',
              properties: {},
              required: []
            }
          }
        },
        // === SCENE MANAGEMENT TOOLS ===
        {
          type: 'function',
          function: {
            name: 'delete_scene_by_heading',
            description: 'Delete a scene by its heading text (case-insensitive match).',
            parameters: {
              type: 'object',
              properties: {
                heading: { type: 'string', description: 'The scene heading to delete (e.g., "INT. OFFICE - DAY")' }
              },
              required: ['heading']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'update_scene',
            description: 'Update a scene\'s details like summary, characters list, or notes.',
            parameters: {
              type: 'object',
              properties: {
                scene_number: { type: 'number', description: 'The scene number to update' },
                summary: { type: 'string', description: 'New summary for the scene' },
                characters: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of character names in this scene'
                },
                notes: { type: 'string', description: 'Notes about the scene' }
              },
              required: ['scene_number']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'renumber_scenes',
            description: 'Sort and renumber all scenes CHRONOLOGICALLY based on their line position in the screenplay. Scenes are sorted by startLine (where they appear in the text) and renumbered 1, 2, 3... ALWAYS call this after adding scenes to ensure proper order.',
            parameters: {
              type: 'object',
              properties: {},
              required: []
            }
          }
        }
      ];

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemPrompt,
        }
      ];

      // Add conversation history if available
      if (context.history && context.history.length > 0) {
        // Increased from 10 to 50 messages for much better conversation continuity
        // GPT-5 mini's efficiency allows us to maintain longer context
        const recentHistory = context.history.slice(-50);
        for (const msg of recentHistory) {
          messages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          });
        }
      }

      messages.push({
        role: 'user',
        content: `${contextPrompt}\n\nUser Question: ${message}`,
      });

      // Determine if we should use tools based on chat mode
      const isAgentMode = context.chatMode === 'agent' || context.chatMode === undefined; // Default to agent

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        // Only include tools in agent mode
        ...(isAgentMode && {
          tools,
          tool_choice: 'auto',
          parallel_tool_calls: true,
        }),
        max_completion_tokens: 4000,
      });

      // Track token usage from first completion
      if (completion.usage) {
        totalPromptTokens += completion.usage.prompt_tokens;
        totalCompletionTokens += completion.usage.completion_tokens;
      }

      const responseMessage = completion.choices[0]?.message;

      console.log('[AI-CHAT] OpenAI response received');
      console.log('[AI-CHAT] Has tool_calls:', !!responseMessage?.tool_calls);
      console.log('[AI-CHAT] Tool calls count:', responseMessage?.tool_calls?.length || 0);
      if (responseMessage?.tool_calls) {
        console.log('[AI-CHAT] Tools called:', responseMessage.tool_calls.map(t => t.function.name).join(', '));
      }
      console.log('[AI-CHAT] Content preview:', responseMessage?.content?.substring(0, 300) || '(no content)');

      // Handle tool calls
      if (responseMessage?.tool_calls) {
        messages.push(responseMessage);

        // Execute all tool calls using the unified executeToolCall method
        for (const toolCall of responseMessage.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments);
          let result = 'Action completed.';

          try {
            // Use the centralized tool execution method for ALL tools
            result = await this.executeToolCall(toolCall.function.name, args, context);
          } catch (error) {
            console.error(`Error executing tool ${toolCall.function.name}:`, error);
            result = `Error: ${error}`;
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result,
          });
        }

        // Continue with another API call - it might need more tool calls
        let continueLoop = true;
        let maxIterations = 25; // High limit for full analysis: scenes + characters + merges + links
        let iterations = 0;

        while (continueLoop && iterations < maxIterations) {
          iterations++;
          console.log(`[AI] Tool call iteration ${iterations}/${maxIterations}`);

          const nextResponse = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            // Include tools in case the model needs to call more
            ...(isAgentMode && {
              tools,
              tool_choice: 'auto',
              parallel_tool_calls: true,
            }),
          });

          // Track token usage
          if (nextResponse.usage) {
            totalPromptTokens += nextResponse.usage.prompt_tokens;
            totalCompletionTokens += nextResponse.usage.completion_tokens;
          }

          const nextMessage = nextResponse.choices[0]?.message;

          // Check if there are more tool calls
          if (nextMessage?.tool_calls && nextMessage.tool_calls.length > 0) {
            messages.push(nextMessage);

            // Execute ALL tool calls using the unified method
            for (const toolCall of nextMessage.tool_calls) {
              const toolArgs = JSON.parse(toolCall.function.arguments);
              const toolResult = await this.executeToolCall(toolCall.function.name, toolArgs, context);

              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: toolResult,
              });
            }
          } else {
            // No more tool calls - return the final response
            continueLoop = false;
            return {
              content: nextMessage?.content || 'Action completed.',
              tokenUsage: {
                promptTokens: totalPromptTokens,
                completionTokens: totalCompletionTokens,
                totalTokens: totalPromptTokens + totalCompletionTokens,
              },
            };
          }
        }

        // If we hit max iterations, return what we have
        return {
          content: 'Completed after multiple tool calls.',
          tokenUsage: {
            promptTokens: totalPromptTokens,
            completionTokens: totalCompletionTokens,
            totalTokens: totalPromptTokens + totalCompletionTokens,
          },
        };
      }

      return {
        content: responseMessage?.content || 'No response generated.',
        tokenUsage: {
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          totalTokens: totalPromptTokens + totalCompletionTokens,
        },
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error('Failed to get AI response: ' + error);
    }
  }

  // Centralized tool execution logic - used for ALL tool calls
  private async executeToolCall(toolName: string, args: any, context?: AIContext): Promise<string> {
    console.log(`[AI-TOOL] Executing: ${toolName}`, JSON.stringify(args).substring(0, 200));
    try {
      switch (toolName) {
        case 'create_character': {
          const charName = args.name.toUpperCase().trim();

          // Comprehensive validation - reject anything that's NOT a character name

          // 1. Scene headings (with or without ! prefix)
          const sceneHeadingPattern = /^!?(INT\.|EXT\.|INT\/EXT\.|I\/E\.|EST\.)/i;
          if (sceneHeadingPattern.test(charName)) {
            return `Skipped: "${charName}" is a scene heading, not a character`;
          }

          // 2. Transitions (CUT TO, FADE, DISSOLVE, etc.)
          const transitionPattern = /^(CUT TO|FADE|DISSOLVE|SMASH CUT|JUMP CUT|MATCH CUT|IRIS|WIPE)[\s:]?/i;
          if (transitionPattern.test(charName)) {
            return `Skipped: "${charName}" is a transition, not a character`;
          }

          // 3. Sound effects and onomatopoeia (ends with ! or all caps with special chars)
          const soundEffectPattern = /^[A-Z\-!]+!$/; // Like BANG!, CRASH!, HAAAAR!
          if (soundEffectPattern.test(charName) && !charName.match(/^[A-Z]+'?[A-Z]*$/)) {
            return `Skipped: "${charName}" looks like a sound effect, not a character`;
          }

          // 4. Action cues that might be mistaken for characters
          const actionCuePattern = /^(CONTINUED|CONTINUOUS|LATER|MORNING|NIGHT|DAY|EVENING|AFTERNOON|DUSK|DAWN|MOMENTS LATER|END OF|FLASHBACK|INTERCUT|MONTAGE|SERIES OF|TITLE CARD|SUPER|CHYRON)/i;
          if (actionCuePattern.test(charName)) {
            return `Skipped: "${charName}" is an action cue, not a character`;
          }

          // 5. Contains typical non-name characters at the start
          if (charName.startsWith('!') || charName.startsWith('.') || charName.startsWith('@')) {
            return `Skipped: "${charName}" has formatting prefix, not a character name`;
          }

          // 6. Check for excessive special characters (not a real name)
          const specialCharCount = (charName.match(/[^A-Z0-9\s'.\-#]/g) || []).length;
          if (specialCharCount > 2) {
            return `Skipped: "${charName}" has too many special characters to be a name`;
          }

          // 7. Too short to be a real character (single letter)
          if (charName.length < 2) {
            return `Skipped: "${charName}" is too short to be a character name`;
          }

          // Check for duplicates
          const existingChars = await this.dbManager.getCharacters();
          const duplicateChar = existingChars.find(c =>
            c.name.toUpperCase().trim() === charName
          );

          if (duplicateChar) {
            return `Character "${charName}" already exists - skipping duplicate`;
          }

          const newCharacter = {
            id: uuidv4(),
            name: charName,
            description: args.description || '',
            age: args.age || '',
            occupation: args.occupation || '',
            personality: args.personality || '',
            goals: args.goals || '',
            arc: '',
            relationships: {},
            appearances: [],
            notes: args.role ? `Role: ${args.role}` : '',
          };
          await this.dbManager.saveCharacter(newCharacter);
          this.systemActions?.notifyUpdate();
          return `✓ Created character: ${newCharacter.name}`;
        }

        case 'add_scene': {
          let sceneHeading = args.heading.toUpperCase().trim();

          // Remove ! prefix if present (Fountain forced scene heading marker)
          if (sceneHeading.startsWith('!')) {
            sceneHeading = sceneHeading.substring(1).trim();
          }

          // Remove . prefix if present (Fountain forced scene heading marker)
          if (sceneHeading.startsWith('.') && !sceneHeading.startsWith('...')) {
            sceneHeading = sceneHeading.substring(1).trim();
          }

          // Validate it looks like a scene heading
          const validScenePattern = /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.|EST\.)/i;
          if (!validScenePattern.test(sceneHeading)) {
            // If it doesn't have INT/EXT, check if it was a forced heading
            // Accept it but log a warning
            console.log(`[AI] Creating scene without standard prefix: ${sceneHeading}`);
          }

          // Check for duplicates (normalize for comparison)
          const existingScenes = await this.dbManager.getScenes();
          const normalizedHeading = sceneHeading.replace(/\s+/g, ' ').trim();
          const duplicateScene = existingScenes.find(s => {
            const existingNorm = s.heading.replace(/\s+/g, ' ').trim().toUpperCase();
            return existingNorm === normalizedHeading;
          });

          if (duplicateScene) {
            return `Scene "${sceneHeading}" already exists (Scene ${duplicateScene.number}) - skipping duplicate`;
          }

          const maxSceneNum = existingScenes.reduce((max, s) => Math.max(max, s.number || 0), 0);

          const newScene = {
            id: uuidv4(),
            number: maxSceneNum + 1,
            heading: sceneHeading,
            location: '',
            timeOfDay: '',
            summary: args.summary || '',
            characters: args.characters || [],
            startLine: args.line_number || 0,  // Store the line number for anchoring
            endLine: args.line_number || 0,
            content: '',
          };
          await this.dbManager.saveScene(newScene);
          this.systemActions?.notifyUpdate();
          return `✓ Created Scene ${newScene.number}: ${newScene.heading} (line ${newScene.startLine})`;
        }

        case 'link_character_to_scene': {
          const linkCharName = args.character_name.toUpperCase().trim();
          const linkSceneNum = args.scene_number;

          const allCharsForLink = await this.dbManager.getCharacters();
          const charToLink = allCharsForLink.find(c =>
            c.name.toUpperCase().trim() === linkCharName
          );

          const allScenesForLink = await this.dbManager.getScenes();
          const sceneToLink = allScenesForLink.find(s => s.number === linkSceneNum);

          if (!charToLink) {
            return `Character "${linkCharName}" not found in database`;
          }

          if (!sceneToLink) {
            return `Scene ${linkSceneNum} not found in database`;
          }

          // Update character's appearances
          const charAppearanceSet = new Set(charToLink.appearances || []);
          charAppearanceSet.add(sceneToLink.id);
          const updatedCharForLink = {
            ...charToLink,
            appearances: Array.from(charAppearanceSet),
          };
          await this.dbManager.saveCharacter(updatedCharForLink);

          // Update scene's character list
          const sceneCharSet = new Set(sceneToLink.characters || []);
          sceneCharSet.add(charToLink.name);
          const updatedSceneForLink = {
            ...sceneToLink,
            characters: Array.from(sceneCharSet),
          };
          await this.dbManager.saveScene(updatedSceneForLink);

          this.systemActions?.notifyUpdate();
          return `✓ Linked ${charToLink.name} to Scene ${linkSceneNum}`;
        }

        case 'merge_characters': {
          const keepName = args.keep_name.toUpperCase().trim();
          const mergeNames: string[] = args.merge_names || [];

          // Find the character to keep
          const allCharsForMerge = await this.dbManager.getCharacters();
          const keepChar = allCharsForMerge.find(c =>
            c.name.toUpperCase().trim() === keepName
          );

          if (!keepChar) {
            return `Character to keep "${keepName}" not found in database`;
          }

          const merged: string[] = [];
          const notFound: string[] = [];
          let mergedAppearances = [...(keepChar.appearances || [])];

          for (const mergeName of mergeNames) {
            const mergeNameNorm = mergeName.toUpperCase().trim();
            const charToMerge = allCharsForMerge.find(c =>
              c.name.toUpperCase().trim() === mergeNameNorm
            );

            if (charToMerge && charToMerge.id !== keepChar.id) {
              // Merge appearances
              mergedAppearances = [...new Set([...mergedAppearances, ...(charToMerge.appearances || [])])];

              // Update any scenes that reference this character
              const allScenes = await this.dbManager.getScenes();
              for (const scene of allScenes) {
                if (scene.characters.includes(charToMerge.name)) {
                  const updatedChars = scene.characters
                    .filter(c => c !== charToMerge.name)
                    .concat(scene.characters.includes(keepChar.name) ? [] : [keepChar.name]);
                  await this.dbManager.saveScene({ ...scene, characters: [...new Set(updatedChars)] });
                }
              }

              // Delete the merged character
              await this.dbManager.deleteCharacter(charToMerge.id);
              merged.push(charToMerge.name);
            } else if (!charToMerge) {
              notFound.push(mergeName);
            }
          }

          // Update the kept character with merged appearances
          await this.dbManager.saveCharacter({
            ...keepChar,
            appearances: mergedAppearances,
          });

          this.systemActions?.notifyUpdate();

          let result = `✓ Merged into ${keepChar.name}:\n`;
          if (merged.length > 0) {
            result += `  Merged: ${merged.join(', ')}\n`;
          }
          if (notFound.length > 0) {
            result += `  Not found: ${notFound.join(', ')}`;
          }
          if (args.reason) {
            result += `  Reason: ${args.reason}`;
          }
          return result;
        }

        case 'delete_character': {
          await this.dbManager.deleteCharacter(args.id);
          this.systemActions?.notifyUpdate();
          return `✓ Deleted character with ID: ${args.id}`;
        }

        case 'delete_character_by_name': {
          const charsToSearch = await this.dbManager.getCharacters();
          const charToDelete = charsToSearch.find(c =>
            c.name.toLowerCase() === args.character_name.toLowerCase()
          );
          if (charToDelete) {
            await this.dbManager.deleteCharacter(charToDelete.id);
            this.systemActions?.notifyUpdate();
            return `✓ Deleted character: ${charToDelete.name}`;
          }
          return `✗ Character not found: "${args.character_name}"`;
        }

        case 'delete_scene': {
          await this.dbManager.deleteScene(args.id);
          this.systemActions?.notifyUpdate();
          return `✓ Deleted scene with ID: ${args.id}`;
        }

        case 'edit_character': {
          const char = await this.dbManager.getCharacter(args.id);
          if (char) {
            const updatedChar = { ...char, ...args };
            await this.dbManager.saveCharacter(updatedChar);
            this.systemActions?.notifyUpdate();
            return `✓ Updated character: ${char.name}`;
          }
          return `Character not found with ID: ${args.id}`;
        }

        case 'read_scene': {
          const scenes = await this.dbManager.getScenes();
          let targetScene = null;

          if (args.scene_id) {
            targetScene = scenes.find(s => s.id === args.scene_id);
          } else if (args.scene_number) {
            targetScene = scenes.find(s => s.number === args.scene_number);
          }

          if (targetScene) {
            let result = `=== SCENE ${targetScene.number}: ${targetScene.heading} ===\n`;
            result += `Characters in scene: ${targetScene.characters.join(', ') || 'None listed'}\n`;
            if (targetScene.summary) {
              result += `Summary: ${targetScene.summary}\n`;
            }
            result += `\n--- FULL SCENE CONTENT ---\n`;
            result += targetScene.content || '(No content available - scene may need re-parsing)';
            result += `\n--- END SCENE ---`;
            return result;
          }
          return `Scene not found. Use list_all_scenes to see available scenes.`;
        }

        case 'read_character': {
          const allCharacters = await this.dbManager.getCharacters();
          let targetChar = null;

          if (args.character_id) {
            targetChar = await this.dbManager.getCharacter(args.character_id);
          } else if (args.character_name) {
            targetChar = allCharacters.find(c =>
              c.name.toLowerCase() === args.character_name.toLowerCase()
            );
          }

          if (targetChar) {
            return `=== CHARACTER: ${targetChar.name} ===\nAppears in ${targetChar.appearances.length} scene(s)`;
          }
          return `Character not found`;
        }

        case 'search_screenplay': {
          const allScenes = await this.dbManager.getScenes();
          const query = args.query.toLowerCase();
          const matches: Array<{ scene: typeof allScenes[0]; excerpts: string[] }> = [];

          for (const scene of allScenes) {
            if (scene.content && scene.content.toLowerCase().includes(query)) {
              // Extract context around matches (show 150 chars before and after)
              const content = scene.content;
              const lowerContent = content.toLowerCase();
              const excerpts: string[] = [];
              let searchStart = 0;

              while (searchStart < lowerContent.length) {
                const idx = lowerContent.indexOf(query, searchStart);
                if (idx === -1) break;

                const start = Math.max(0, idx - 100);
                const end = Math.min(content.length, idx + query.length + 100);
                const excerpt = (start > 0 ? '...' : '') +
                  content.substring(start, end) +
                  (end < content.length ? '...' : '');
                excerpts.push(excerpt);
                searchStart = idx + query.length;

                // Limit to 3 excerpts per scene
                if (excerpts.length >= 3) break;
              }

              matches.push({ scene, excerpts });
            }
          }

          if (matches.length === 0) {
            return `No matches found for "${args.query}" in the screenplay.`;
          }

          let result = `=== SEARCH RESULTS FOR "${args.query}" ===\n`;
          result += `Found in ${matches.length} scene(s):\n\n`;

          for (const match of matches) {
            result += `--- Scene ${match.scene.number}: ${match.scene.heading} ---\n`;
            for (const excerpt of match.excerpts) {
              result += `"${excerpt.trim()}"\n`;
            }
            result += '\n';
          }

          return result;
        }

        // === FULL CONTENT ACCESS TOOLS ===
        case 'read_full_screenplay': {
          // Get the full screenplay content from context or reconstruct from scenes
          if (context?.currentContent && context.currentContent.trim()) {
            const wordCount = context.currentContent.split(/\s+/).length;
            const pageEstimate = Math.round(wordCount / 250);
            return `=== FULL SCREENPLAY (${pageEstimate} pages, ${wordCount} words) ===\n\n${context.currentContent}\n\n=== END OF SCREENPLAY ===`;
          }

          // Fallback: reconstruct from scenes if no direct content
          const allScenes = await this.dbManager.getScenes();
          if (allScenes.length === 0) {
            return 'No screenplay content available. The screenplay may be empty.';
          }

          const sortedScenes = allScenes.sort((a, b) => (a.number || 0) - (b.number || 0));
          let fullContent = '=== FULL SCREENPLAY (reconstructed from scenes) ===\n\n';

          for (const scene of sortedScenes) {
            fullContent += `${scene.heading}\n\n`;
            if (scene.content) {
              fullContent += `${scene.content}\n\n`;
            }
          }

          fullContent += '=== END OF SCREENPLAY ===';
          return fullContent;
        }

        case 'read_scene_with_context': {
          const allScenes = await this.dbManager.getScenes();
          const sortedScenes = allScenes.sort((a, b) => (a.number || 0) - (b.number || 0));
          const targetNum = args.scene_number;
          const contextCount = args.context_scenes || 1;

          const targetIdx = sortedScenes.findIndex(s => s.number === targetNum);
          if (targetIdx === -1) {
            return `Scene ${targetNum} not found. Use list_all_scenes to see available scenes.`;
          }

          const startIdx = Math.max(0, targetIdx - contextCount);
          const endIdx = Math.min(sortedScenes.length - 1, targetIdx + contextCount);

          let result = `=== SCENE ${targetNum} WITH CONTEXT ===\n\n`;

          for (let i = startIdx; i <= endIdx; i++) {
            const scene = sortedScenes[i];
            const marker = i === targetIdx ? '>>> TARGET SCENE <<<' : '';
            result += `--- Scene ${scene.number}: ${scene.heading} ${marker}---\n`;
            result += scene.content || '(No content)';
            result += '\n\n';
          }

          return result;
        }

        case 'analyze_character_arc': {
          const charName = args.character_name.toUpperCase().trim();
          const allScenes = await this.dbManager.getScenes();
          const sortedScenes = allScenes.sort((a, b) => (a.number || 0) - (b.number || 0));

          const appearances: Array<{ scene: typeof sortedScenes[0]; excerpt: string }> = [];

          for (const scene of sortedScenes) {
            if (!scene.content) continue;

            // Check if character appears in this scene (as dialogue or mentioned)
            const upperContent = scene.content.toUpperCase();
            if (upperContent.includes(charName)) {
              // Extract relevant lines mentioning this character
              const lines = scene.content.split('\n');
              const relevantLines: string[] = [];
              let inDialogue = false;

              for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                const upperLine = line.toUpperCase();

                // Check if this is the character's cue
                if (upperLine === charName || upperLine.startsWith(charName + ' (')) {
                  inDialogue = true;
                  relevantLines.push(`[SPEAKS] ${line}`);
                  // Get their dialogue (next non-empty lines until another cue)
                  for (let j = i + 1; j < lines.length && j < i + 5; j++) {
                    const nextLine = lines[j].trim();
                    if (nextLine && !nextLine.match(/^[A-Z]{2,}(\s|$)/)) {
                      relevantLines.push(`  "${nextLine}"`);
                    } else if (nextLine.match(/^[A-Z]{2,}(\s|$)/)) {
                      break;
                    }
                  }
                } else if (upperLine.includes(charName) && !inDialogue) {
                  relevantLines.push(`[ACTION] ${line}`);
                }

                if (line === '' || line.match(/^[A-Z]{2,}(\s|$)/)) {
                  inDialogue = false;
                }
              }

              if (relevantLines.length > 0) {
                appearances.push({
                  scene,
                  excerpt: relevantLines.slice(0, 8).join('\n')
                });
              }
            }
          }

          if (appearances.length === 0) {
            return `Character "${charName}" not found in any scenes.`;
          }

          let result = `=== CHARACTER ARC: ${charName} ===\n`;
          result += `Appears in ${appearances.length} scene(s)\n\n`;

          for (const app of appearances) {
            result += `--- Scene ${app.scene.number}: ${app.scene.heading} ---\n`;
            result += app.excerpt;
            result += '\n\n';
          }

          return result;
        }

        case 'find_character_dialogue': {
          const charName = args.character_name.toUpperCase().trim();
          const allScenes = await this.dbManager.getScenes();
          const sortedScenes = allScenes.sort((a, b) => (a.number || 0) - (b.number || 0));

          const dialogues: Array<{ sceneNum: number; heading: string; dialogue: string[] }> = [];

          for (const scene of sortedScenes) {
            if (!scene.content) continue;

            const lines = scene.content.split('\n');
            const sceneDialogues: string[] = [];

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              const upperLine = line.toUpperCase();

              // Check if this is the character's cue
              if (upperLine === charName || upperLine.startsWith(charName + ' (')) {
                // Collect their dialogue
                let dialogue = '';
                for (let j = i + 1; j < lines.length; j++) {
                  const nextLine = lines[j].trim();
                  if (!nextLine) continue;
                  // Stop at next character cue or scene heading
                  if (nextLine.match(/^[A-Z]{2,}[^a-z]*$/) && !nextLine.startsWith('(')) {
                    break;
                  }
                  if (nextLine.startsWith('(') && nextLine.endsWith(')')) {
                    dialogue += `${nextLine} `;
                  } else {
                    dialogue += nextLine + ' ';
                  }
                }
                if (dialogue.trim()) {
                  sceneDialogues.push(dialogue.trim());
                }
              }
            }

            if (sceneDialogues.length > 0) {
              dialogues.push({
                sceneNum: scene.number,
                heading: scene.heading,
                dialogue: sceneDialogues
              });
            }
          }

          if (dialogues.length === 0) {
            return `No dialogue found for "${charName}".`;
          }

          let result = `=== ALL DIALOGUE BY ${charName} ===\n`;
          result += `Found dialogue in ${dialogues.length} scene(s)\n\n`;

          for (const d of dialogues) {
            result += `--- Scene ${d.sceneNum}: ${d.heading} ---\n`;
            for (const line of d.dialogue) {
              result += `"${line}"\n`;
            }
            result += '\n';
          }

          return result;
        }

        case 'analyze_scene_characters': {
          const sceneNum = args.scene_number;
          const allScenes = await this.dbManager.getScenes();
          const scene = allScenes.find(s => s.number === sceneNum);

          if (!scene) {
            return `Scene ${sceneNum} not found.`;
          }

          if (!scene.content) {
            return `Scene ${sceneNum} has no content.`;
          }

          // Extract all characters who speak in this scene
          const lines = scene.content.split('\n');
          const characterData: Map<string, { dialogueCount: number; lines: string[] }> = new Map();

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Character cue pattern: ALL CAPS, possibly with extension
            const charMatch = line.match(/^([A-Z][A-Z\s'-]+)(\s*\([^)]+\))?$/);
            if (charMatch && line.length < 40) {
              const charName = charMatch[1].trim();

              // Skip scene headings and transitions
              if (charName.match(/^(INT|EXT|CUT|FADE|DISSOLVE)/)) continue;

              // Get their dialogue
              let dialogue = '';
              for (let j = i + 1; j < lines.length; j++) {
                const nextLine = lines[j].trim();
                if (!nextLine) continue;
                if (nextLine.match(/^[A-Z]{2,}[^a-z]*$/) && !nextLine.startsWith('(')) {
                  break;
                }
                if (!nextLine.startsWith('(')) {
                  dialogue += nextLine + ' ';
                }
              }

              if (!characterData.has(charName)) {
                characterData.set(charName, { dialogueCount: 0, lines: [] });
              }
              const data = characterData.get(charName)!;
              data.dialogueCount++;
              if (dialogue.trim()) {
                data.lines.push(dialogue.trim().substring(0, 100) + (dialogue.length > 100 ? '...' : ''));
              }
            }
          }

          let result = `=== SCENE ${sceneNum} CHARACTER ANALYSIS ===\n`;
          result += `${scene.heading}\n\n`;

          if (characterData.size === 0) {
            result += 'No speaking characters detected in this scene.';
          } else {
            result += `Speaking characters: ${characterData.size}\n\n`;

            for (const [name, data] of characterData) {
              result += `**${name}** (${data.dialogueCount} line(s)):\n`;
              for (const line of data.lines.slice(0, 3)) {
                result += `  "${line}"\n`;
              }
              result += '\n';
            }
          }

          return result;
        }

        case 'find_plot_events': {
          const eventType = args.event_type.toLowerCase();

          // Keywords associated with different event types
          const eventKeywords: Record<string, string[]> = {
            'death': ['dies', 'dead', 'kill', 'killed', 'murder', 'shot', 'stabbed', 'falls dead', 'body', 'corpse', 'funeral', 'death'],
            'fight': ['punch', 'fight', 'hit', 'struggle', 'attack', 'battle', 'wrestle', 'kicks', 'throws'],
            'kiss': ['kiss', 'kisses', 'embrace', 'lips meet', 'passionate'],
            'reveal': ['reveal', 'truth', 'secret', 'discovers', 'realizes', 'finds out', 'confession', 'admits'],
            'confrontation': ['confronts', 'argues', 'yells', 'shouts', 'accuses', 'demands', 'threatens'],
            'arrival': ['enters', 'arrives', 'appears', 'walks in', 'shows up'],
            'departure': ['leaves', 'exits', 'walks out', 'departs', 'drives away', 'runs off'],
            'phone': ['phone', 'calls', 'text', 'message', 'rings', 'answers'],
          };

          const keywords = eventKeywords[eventType] || [eventType];

          const allScenes = await this.dbManager.getScenes();
          const sortedScenes = allScenes.sort((a, b) => (a.number || 0) - (b.number || 0));

          const matches: Array<{ scene: typeof sortedScenes[0]; excerpts: string[] }> = [];

          for (const scene of sortedScenes) {
            if (!scene.content) continue;

            const lowerContent = scene.content.toLowerCase();
            const foundKeywords = keywords.filter(kw => lowerContent.includes(kw));

            if (foundKeywords.length > 0) {
              // Extract context around matches
              const excerpts: string[] = [];
              const lines = scene.content.split('\n');

              for (let i = 0; i < lines.length; i++) {
                const lowerLine = lines[i].toLowerCase();
                if (foundKeywords.some(kw => lowerLine.includes(kw))) {
                  // Get this line plus surrounding context
                  const start = Math.max(0, i - 1);
                  const end = Math.min(lines.length - 1, i + 2);
                  const context = lines.slice(start, end + 1).join('\n').trim();
                  if (context && !excerpts.includes(context)) {
                    excerpts.push(context);
                  }
                }
              }

              if (excerpts.length > 0) {
                matches.push({ scene, excerpts: excerpts.slice(0, 3) });
              }
            }
          }

          if (matches.length === 0) {
            return `No "${eventType}" events found in the screenplay. Try different keywords or use search_screenplay for custom searches.`;
          }

          let result = `=== "${eventType.toUpperCase()}" EVENTS FOUND ===\n`;
          result += `Found in ${matches.length} scene(s)\n\n`;

          for (const match of matches) {
            result += `--- Scene ${match.scene.number}: ${match.scene.heading} ---\n`;
            for (const excerpt of match.excerpts) {
              result += `"${excerpt}"\n\n`;
            }
          }

          return result;
        }

        // === LIST/OVERVIEW TOOLS ===
        case 'list_all_characters': {
          const allChars = await this.dbManager.getCharacters();
          if (allChars.length === 0) {
            return 'No characters in database yet.';
          }

          const charList = allChars
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(c => `- ${c.name} (${c.appearances?.length || 0} scenes)`)
            .join('\n');

          return `=== ${allChars.length} CHARACTERS IN DATABASE ===\n${charList}`;
        }

        case 'list_all_scenes': {
          const allScenes = await this.dbManager.getScenes();
          if (allScenes.length === 0) {
            return 'No scenes in database yet.';
          }

          const sceneList = allScenes
            .sort((a, b) => (a.number || 0) - (b.number || 0))
            .map(s => `${s.number}. ${s.heading} (${s.characters?.length || 0} chars)`)
            .join('\n');

          return `=== ${allScenes.length} SCENES IN DATABASE ===\n${sceneList}`;
        }

        // === SCENE MANAGEMENT TOOLS ===
        case 'delete_scene_by_heading': {
          const headingToDelete = args.heading.toUpperCase().trim();
          const allScenesForDelete = await this.dbManager.getScenes();
          const sceneToDelete = allScenesForDelete.find(s =>
            s.heading.toUpperCase().trim() === headingToDelete
          );

          if (!sceneToDelete) {
            return `Scene with heading "${headingToDelete}" not found`;
          }

          await this.dbManager.deleteScene(sceneToDelete.id);
          this.systemActions?.notifyUpdate();
          return `✓ Deleted Scene ${sceneToDelete.number}: ${sceneToDelete.heading}`;
        }

        case 'update_scene': {
          const sceneNum = args.scene_number;
          const allScenesForUpdate = await this.dbManager.getScenes();
          const sceneToUpdate = allScenesForUpdate.find(s => s.number === sceneNum);

          if (!sceneToUpdate) {
            return `Scene ${sceneNum} not found`;
          }

          const updates: any = {};
          if (args.summary !== undefined) updates.summary = args.summary;
          if (args.characters !== undefined) updates.characters = args.characters;
          if (args.notes !== undefined) updates.notes = args.notes;

          await this.dbManager.saveScene({ ...sceneToUpdate, ...updates });
          this.systemActions?.notifyUpdate();

          const updatedFields = Object.keys(updates).join(', ');
          return `✓ Updated Scene ${sceneNum}: ${updatedFields}`;
        }

        case 'renumber_scenes': {
          const allScenesForRenumber = await this.dbManager.getScenes();

          // Sort by startLine (chronological order in screenplay) - scenes with line 0 go to end
          const sortedScenes = allScenesForRenumber.sort((a, b) => {
            const lineA = a.startLine || 99999;
            const lineB = b.startLine || 99999;
            return lineA - lineB;
          });

          // Renumber sequentially based on chronological order
          let newNumber = 1;
          let reordered = 0;
          for (const scene of sortedScenes) {
            if (scene.number !== newNumber) {
              await this.dbManager.saveScene({ ...scene, number: newNumber });
              reordered++;
            }
            newNumber++;
          }

          this.systemActions?.notifyUpdate();
          console.log(`[AI] Renumbered scenes by line position: ${reordered} scenes moved`);
          return `✓ Renumbered ${sortedScenes.length} scenes chronologically by line position (${reordered} reordered)`;
        }

        // === BATCH OPERATIONS ===
        case 'delete_characters_batch': {
          const allCharsForBatch = await this.dbManager.getCharacters();
          const deleted: string[] = [];
          const notFound: string[] = [];

          for (const name of args.character_names) {
            const match = allCharsForBatch.find(c =>
              c.name.toLowerCase() === name.toLowerCase()
            );
            if (match) {
              await this.dbManager.deleteCharacter(match.id);
              deleted.push(match.name);
            } else {
              notFound.push(name);
            }
          }

          this.systemActions?.notifyUpdate();

          let result = `**Batch Delete Results:**\n`;
          if (deleted.length > 0) {
            result += `✓ Deleted (${deleted.length}): ${deleted.join(', ')}\n`;
          }
          if (notFound.length > 0) {
            result += `✗ Not Found (${notFound.length}): ${notFound.join(', ')}`;
          }
          return result;
        }

        // === METADATA ===
        case 'set_screenplay_metadata': {
          console.log('[AI-METADATA] ========================================');
          console.log('[AI-METADATA] Setting screenplay metadata:', args);
          const results: string[] = [];
          if (args.title) {
            if (this.systemActions) {
              console.log('[AI-METADATA] Setting title to:', args.title);
              this.systemActions.setScreenplayTitle(args.title);
              results.push(`✓ Title set to: "${args.title}"`);
            } else {
              console.log('[AI-METADATA] ERROR: No systemActions available for title!');
            }
          }
          if (args.author) {
            if (this.systemActions) {
              console.log('[AI-METADATA] Setting author to:', args.author);
              this.systemActions.setScreenplayAuthor(args.author);
              results.push(`✓ Author set to: "${args.author}"`);
            } else {
              console.log('[AI-METADATA] ERROR: No systemActions available for author!');
            }
          }
          if (results.length === 0) {
            console.log('[AI-METADATA] ERROR: No title or author provided in args');
            return '✗ No title or author provided.';
          }
          console.log('[AI-METADATA] Success:', results.join(', '));
          console.log('[AI-METADATA] ========================================');
          return results.join('\n');
        }

        // === SYSTEM ACTIONS ===
        case 'save_screenplay': {
          if (this.systemActions) {
            await this.systemActions.saveScreenplay();
            return '✓ Screenplay saved successfully.';
          }
          return '✗ Save functionality not available.';
        }

        case 'export_screenplay': {
          if (this.systemActions) {
            await this.systemActions.exportScreenplay(args.format);
            return `✓ Screenplay exported to ${args.format} successfully.`;
          }
          return '✗ Export functionality not available.';
        }

        case 'update_content': {
          if (this.systemActions && this.systemActions.previewUpdate) {
            this.systemActions.previewUpdate({
              original: args.original_text,
              modified: args.new_text,
              description: args.description
            });
            return `I have proposed a change: "${args.description}". Please review it in the editor and click Accept or Reject.`;
          }
          return '✗ Content update functionality not available.';
        }

        // === QUERY TOOLS ===
        case 'get_character_scenes': {
          const charScenesData = await this.dbManager.getScenes();
          const searchName = args.character_name.toUpperCase();
          const charAppearances = charScenesData.filter(s =>
            s.characters.some(c => c.toUpperCase() === searchName) ||
            (s.content && s.content.toUpperCase().includes(searchName))
          );

          if (charAppearances.length > 0) {
            let result = `${searchName} appears in ${charAppearances.length} scene(s):\n\n`;
            for (const scene of charAppearances) {
              result += `=== Scene ${scene.number}: ${scene.heading} ===\n`;
              result += (scene.content || '[No content]').substring(0, 500);
              if (scene.content && scene.content.length > 500) result += '...\n';
              result += '\n\n';
            }
            return result;
          }
          return `${searchName} not found in any scenes.`;
        }

        case 'get_screenplay_section': {
          const sectionScenes = await this.dbManager.getScenes();
          const startNum = args.start_scene;
          const endNum = args.end_scene;
          const section = sectionScenes.filter(s => s.number >= startNum && s.number <= endNum);

          if (section.length > 0) {
            let result = `=== SCENES ${startNum} to ${endNum} ===\n\n`;
            for (const scene of section) {
              result += `--- Scene ${scene.number}: ${scene.heading} ---\n`;
              result += scene.content || '[No content]';
              result += '\n\n';
            }
            return result;
          }
          return `No scenes found in range ${startNum}-${endNum}. Total scenes: ${sectionScenes.length}`;
        }

        default:
          console.warn(`[AI] Unknown tool called: ${toolName}`);
          return `Tool ${toolName} not implemented.`;
      }
    } catch (error) {
      console.error(`[AI] Error executing tool ${toolName}:`, error);
      return `Error: ${error}`;
    }
  }

  async generateDialogue(character: string, context: string): Promise<string> {
    try {
      const characterInfo = await this.dbManager.getCharacter(character);

      let characterContext = '';
      if (characterInfo) {
        characterContext = `
Character: ${characterInfo.name}
Description: ${characterInfo.description}
Arc: ${characterInfo.arc}
`;
      }

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a professional screenplay dialogue writer. Generate authentic, character-consistent dialogue that advances the story and reveals character.',
          },
          {
            role: 'user',
            content: `${characterContext}\n\nScene Context: ${context}\n\nGenerate dialogue for ${character}:`,
          },
        ],
        temperature: 0.8,
        max_completion_tokens: 2000,
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Dialogue generation error:', error);
      throw error;
    }
  }

  async expandScene(outline: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a professional screenwriter. Expand scene outlines into fully written screenplay scenes with proper formatting, vivid action lines, and natural dialogue.',
          },
          {
            role: 'user',
            content: `Expand this scene outline into a complete screenplay scene:\n\n${outline}`,
          },
        ],
        max_completion_tokens: 6000,
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Scene expansion error:', error);
      throw error;
    }
  }

  async analyzeStoryline(): Promise<Storyline> {
    try {
      const scenes = await this.dbManager.getScenes();


      if (scenes.length === 0) {
        throw new Error('No scenes to analyze');
      }

      // Build context for analysis
      const scenesSummary = scenes
        .map((s) => `Scene ${s.number}: ${s.heading}\n${s.content.substring(0, 200)}...`)
        .join('\n\n');

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional script consultant. Analyze the provided screenplay and identify:
1. The three-act structure
2. Major plot points (inciting incident, first plot point, midpoint, crisis, climax, resolution)
3. Central themes
4. Overall narrative structure

Respond in JSON format with this structure:
{
  "act": 1,
  "plotPoints": [
    {
      "id": "unique-id",
      "name": "Plot Point Name",
      "description": "Description of the plot point",
      "sceneId": "scene-id-if-applicable",
      "timestamp": 1234567890
    }
  ],
  "themes": ["theme1", "theme2"],
  "narrativeStructure": "Description of the overall narrative approach"
}`,
          },
          {
            role: 'user',
            content: `Analyze this screenplay:\n\n${scenesSummary}`,
          },
        ],
        temperature: 0.5,
        max_completion_tokens: 4000,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content || '{}';
      const analysis = JSON.parse(response);

      // Ensure proper structure
      const storyline: Storyline = {
        id: Date.now().toString(),
        act: analysis.act || 1,
        plotPoints: analysis.plotPoints || [],
        themes: analysis.themes || [],
        narrativeStructure: analysis.narrativeStructure || '',
      };

      return storyline;
    } catch (error) {
      console.error('Storyline analysis error:', error);
      throw error;
    }
  }

  async suggestNextLine(currentContent: string, cursorPosition: number): Promise<string> {
    try {
      const contentBeforeCursor = currentContent.substring(0, cursorPosition);
      // const contentAfterCursor = currentContent.substring(cursorPosition);

      // Get last few lines for context
      const lines = contentBeforeCursor.split('\n');
      const contextLines = lines.slice(-10).join('\n');

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an AI writing assistant for screenwriters. Suggest the next line or complete the current line based on context. Keep suggestions brief and natural.',
          },
          {
            role: 'user',
            content: `Current screenplay context:\n${contextLines}\n\nSuggest what comes next:`,
          },
        ],
        max_completion_tokens: 150,
      });

      return completion.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
      console.error('Suggestion error:', error);
      throw error;
    }
  }

  async checkConsistency(content: string, context: AIContext): Promise<any[]> {
    try {
      const systemPrompt = this.contextBuilder.buildSystemPrompt(context);

      // Build comprehensive context for thorough consistency checking
      const contextPrompt = this.contextBuilder.buildContextPrompt(context);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}\n\nYou are a script consultant performing a deep continuity and consistency check. Analyze the screenplay for:
- Character behavior inconsistencies (actions that contradict established personality/motivation)
- Plot logic errors (events that don't make sense or contradict earlier information)
- Timeline/continuity issues (character locations, time of day, props, wardrobe)
- Dialogue inconsistencies (character voice changes, contradictory statements)
- Thematic coherence (scenes that undermine the story's themes)

Return a JSON object with this structure:
{
  "issues": [
    {
      "type": "character" | "plot" | "continuity" | "dialogue" | "theme",
      "severity": "critical" | "moderate" | "minor",
      "description": "Clear description of the issue",
      "location": "Scene number or character name",
      "suggestion": "How to fix it"
    }
  ]
}`,
          },
          {
            role: 'user',
            content: `${contextPrompt}\n\nPerform a comprehensive consistency check on this screenplay:\n\n${content.substring(0, 20000)}`,
          },
        ],
        temperature: 0.3,
        max_completion_tokens: 6000,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content || '{"issues": []}';
      const result = JSON.parse(response);

      return result.issues || [];
    } catch (error) {
      console.error('Consistency check error:', error);
      throw error;
    }
  }

  async analyzeFullScript(): Promise<any> {
    try {
      const context = await this.contextBuilder.buildFullContext();
      const systemPrompt = this.contextBuilder.buildSystemPrompt(context);
      const contextPrompt = this.contextBuilder.buildContextPrompt(context);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}\n\nYou are performing a comprehensive professional script analysis. Evaluate:

1. STRUCTURE: Three-act structure, pacing, act breaks, turning points
2. CHARACTERS: Arcs, consistency, depth, relationships
3. DIALOGUE: Authenticity, subtext, character voice, efficiency
4. THEMES: Clarity, integration, depth
5. PACING: Scene length, momentum, tension/release
6. MARKETABILITY: Genre fit, target audience, commercial appeal

Return detailed JSON analysis with specific examples and actionable feedback.`,
          },
          {
            role: 'user',
            content: `${contextPrompt}\n\nProvide a comprehensive professional analysis of this screenplay.`,
          },
        ],
        temperature: 0.5,
        max_completion_tokens: 8000,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content || '{}';
      return JSON.parse(response);
    } catch (error) {
      console.error('Full script analysis error:', error);
      throw error;
    }
  }

  /**
   * LLM-powered screenplay analysis that DIRECTLY creates characters and scenes in the database.
   * Uses the same tool infrastructure as the chat function - calls systemActions to save to DB.
   */
  async analyzeScreenplayContent(content: string): Promise<{
    title?: string;
    author?: string;
    scenes: Array<{
      number: number;
      heading: string;
      location: string;
      timeOfDay: string;
      lineNumber: number;
    }>;
    characters: Array<{
      name: string;
      normalizedName: string;
      aliases: string[];
      dialogueCount: number;
      firstAppearance: number;
      description?: string;
    }>;
    duplicates: Array<{
      names: string[];
      suggestedName: string;
      reason: string;
    }>;
  }> {
    console.log('[AI] Starting LLM screenplay analysis - will CREATE characters and scenes in database...');

    if (!this.systemActions) {
      throw new Error('System actions not available - cannot save to database');
    }

    // Track what we create
    const createdCharacters: Array<{ name: string; normalizedName: string; aliases: string[]; dialogueCount: number; firstAppearance: number }> = [];
    const createdScenes: Array<{ number: number; heading: string; location: string; timeOfDay: string; lineNumber: number }> = [];
    let sceneCounter = 0;

    // CLEAR ALL EXISTING SCENES before analysis
    // This ensures all scenes get fresh line numbers and proper ordering
    console.log('[AI-ANALYSIS] Clearing existing scenes for fresh analysis...');
    const existingScenes = await this.dbManager.getScenes();
    for (const scene of existingScenes) {
      await this.dbManager.deleteScene(scene.id);
    }
    console.log(`[AI-ANALYSIS] Deleted ${existingScenes.length} existing scenes`);
    this.systemActions?.notifyUpdate();

    // Use a MINIMAL context - don't show existing database items
    // This forces the AI to analyze the content freshly and create items via tools
    const context: AIContext = {
      currentContent: '', // Don't put content here - it's in the prompt
      characters: [], // Empty - don't show existing, let AI discover
      scenes: [], // Empty - don't show existing, let AI discover
      chatMode: 'agent', // Force agent mode for tool use
    };

    // Build a focused analysis prompt
    const analysisPrompt = `You are an intelligent screenplay assistant. You MUST analyze this screenplay and call tools to register what you find.

IMPORTANT: The scene database has been CLEARED. You must create ALL scenes fresh.
Your job is to:
1. Find EVERY scene in the screenplay content below
2. Call add_scene for EACH scene with accurate line_number
3. Create all speaking characters
4. The scenes will be sorted chronologically by line_number at the end

**STEP 0 - FIRST: Extract Title Page Information:**
Look at the VERY FIRST LINES of the screenplay for title/author.
The title page is BEFORE any INT./EXT. scene headings.

Call set_screenplay_metadata IMMEDIATELY with what you find:
- Title: Usually the first non-blank line (e.g., "Pilot 1.03 SOTS")
- Author: Look for "written by", "by [NAME]", or "Author:"

Example from this screenplay - the first lines might be:
"Pilot 1.03 SOTS" (this is the TITLE)
"written by" 
"by Lenny Pappano" (this is the AUTHOR - "Lenny Pappano")

YOU MUST CALL set_screenplay_metadata with title and author NOW before proceeding!

**STEP 1 - Create ALL Scenes (with line numbers):**
Find EVERY scene heading in the screenplay. Scene headings are:
- Lines starting with INT. or EXT. or INT./EXT. or I/E. or EST.
- Lines starting with ! followed by INT. or EXT. (forced scene headings in Fountain)
- Lines starting with . followed by text (forced scene headings)

For EACH scene heading found, call add_scene with:
- heading: The FULL scene heading text
- line_number: The approximate line number where this scene appears (count from the start of the screenplay)
- summary: Brief description of what happens

IMPORTANT: Include line_number so scenes can be anchored to the correct position in the screenplay!

**STEP 2 - Create ONLY Speaking Characters:**
A CHARACTER is ONLY someone who SPEAKS dialogue. In screenplay format:
- Character name appears ALONE on a line in UPPERCASE
- Followed by their dialogue on the next lines

DO NOT create these as characters:
- Scene headings (INT., EXT., !EXT., etc.)
- Transitions (CUT TO:, FADE OUT, DISSOLVE TO:, JUMP CUT:)
- Sound effects (BANG!, CRASH!, onomatopoeia)
- Time indicators (LATER, CONTINUOUS, MORNING)
- Action descriptions or parentheticals

**STEP 3 - Merge Duplicate Characters:**
Look for characters that are the SAME PERSON with different names:
- "HENRY" and "HENRY MARCHETTI" → same person
- "O'KEEFE" and "O'KEEFFE" and "POLICE CHIEF O'KEEFFE" → same person
- "MOM" and "LORIE" → might be same person if context shows it

For each set of duplicates, call merge_characters with:
- keep_name: the most complete/common name
- merge_names: array of variant names to merge in
- reason: why they're the same character

**STEP 4 - Link Characters to Scenes:**
Link each character to the scenes where they SPEAK.
Call link_character_to_scene for each character+scene combination.

**STEP 5 - ALWAYS Renumber Scenes Chronologically:**
After creating all scenes, you MUST call renumber_scenes to:
- Sort scenes by their line_number (chronological order in screenplay)
- Renumber them 1, 2, 3... based on where they appear
- This ensures Scene 1 is the FIRST scene in the screenplay

**STEP 6 - Verify:**
1. Call list_all_scenes to confirm they're in correct order
2. Call list_all_characters to see what exists
3. Look for any remaining duplicates or issues

**CRITICAL RULES:**
1. READ THE ENTIRE SCREENPLAY BELOW - don't stop early
2. Create EVERY scene, even if similar headings exist
3. Only create actual PEOPLE as characters
4. Identify and MERGE duplicate character names
5. Use the tools - don't just describe what you found
6. VERIFY your work at the end by listing what exists

=== FULL SCREENPLAY CONTENT (analyze this) ===

${content}

=== END OF SCREENPLAY ===

Start analyzing the screenplay now and call the tools for EVERY scene and character you find:`;

    // Call the existing chat function which has all the tool execution logic
    console.log('[AI-ANALYSIS] ========================================');
    console.log('[AI-ANALYSIS] Starting screenplay analysis');
    console.log('[AI-ANALYSIS] Content length:', content.length);
    console.log('[AI-ANALYSIS] First 800 chars of screenplay:');
    console.log(content.substring(0, 800));
    console.log('[AI-ANALYSIS] ========================================');

    try {
      const response = await this.chat(analysisPrompt, context);
      console.log('[AI-ANALYSIS] Chat response (first 500 chars):', response.content.substring(0, 500));

      // After chat completes, get the created items from the database
      const allCharacters = await this.dbManager.getCharacters();
      const allScenes = await this.dbManager.getScenes();

      // Convert to the expected format
      for (const char of allCharacters) {
        createdCharacters.push({
          name: char.name,
          normalizedName: char.name.toUpperCase(),
          aliases: [],
          dialogueCount: char.appearances?.length || 0,
          firstAppearance: 0,
        });
      }

      for (const scene of allScenes) {
        sceneCounter++;
        createdScenes.push({
          number: scene.number || sceneCounter,
          heading: scene.heading,
          location: scene.heading.split('-')[0]?.replace(/^(INT\.|EXT\.|INT\.\/EXT\.)/, '').trim() || '',
          timeOfDay: scene.heading.split('-')[1]?.trim() || '',
          lineNumber: scene.startLine || 0,
        });
      }

      console.log(`[AI] Analysis complete: ${createdScenes.length} scenes, ${createdCharacters.length} characters in database`);

      return {
        scenes: createdScenes,
        characters: createdCharacters,
        duplicates: [], // Chat function handles duplicates via delete tools
      };

    } catch (error) {
      console.error('[AI] Analysis failed:', error);
      throw error;
    }
  }

}

