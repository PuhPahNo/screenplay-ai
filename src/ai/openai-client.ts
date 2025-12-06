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
            description: 'Add a new scene to the screenplay. YOU MUST USE THIS TOOL when the user asks to add or create a scene.',
            parameters: {
              type: 'object',
              properties: {
                heading: { type: 'string', description: 'Scene heading (e.g. INT. OFFICE - DAY)' },
                summary: { type: 'string', description: 'Brief summary of the scene' },
                characters: { type: 'array', items: { type: 'string' }, description: 'List of character names in the scene' }
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
            description: 'Renumber all scenes sequentially starting from 1. Use after deleting scenes to fix gaps.',
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
        model: 'gpt-5-mini',
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

      // Handle tool calls
      if (responseMessage?.tool_calls) {
        messages.push(responseMessage);

        // Execute all tool calls using the unified executeToolCall method
        for (const toolCall of responseMessage.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments);
          let result = 'Action completed.';

          try {
            // Use the centralized tool execution method for ALL tools
            result = await this.executeToolCall(toolCall.function.name, args);
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
            model: 'gpt-5-mini',
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
              const toolResult = await this.executeToolCall(toolCall.function.name, toolArgs);

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
  private async executeToolCall(toolName: string, args: any): Promise<string> {
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
            startLine: 0,
            endLine: 0,
            content: '',
          };
          await this.dbManager.saveScene(newScene);
          this.systemActions?.notifyUpdate();
          return `✓ Created Scene ${newScene.number}: ${newScene.heading}`;
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
            return `=== SCENE ${targetScene.number}: ${targetScene.heading} ===\nCharacters: ${targetScene.characters.join(', ') || 'None listed'}`;
          }
          return `Scene not found`;
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
          const matches: string[] = [];

          for (const scene of allScenes) {
            if (scene.content && scene.content.toLowerCase().includes(query)) {
              matches.push(`Scene ${scene.number} (${scene.heading})`);
            }
          }

          return matches.length > 0
            ? `Found "${args.query}" in ${matches.length} scene(s): ${matches.join(', ')}`
            : `No matches found for "${args.query}"`;
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

          // Sort by current number
          const sortedScenes = allScenesForRenumber.sort((a, b) => (a.number || 0) - (b.number || 0));

          // Renumber sequentially
          let newNumber = 1;
          for (const scene of sortedScenes) {
            if (scene.number !== newNumber) {
              await this.dbManager.saveScene({ ...scene, number: newNumber });
            }
            newNumber++;
          }

          this.systemActions?.notifyUpdate();
          return `✓ Renumbered ${sortedScenes.length} scenes (1 to ${sortedScenes.length})`;
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
        model: 'gpt-5-mini',
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
        model: 'gpt-5-mini',
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
        model: 'gpt-5-mini',
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
        model: 'gpt-5-mini',
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
        model: 'gpt-5-mini',
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
        model: 'gpt-5-mini',
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

    // Use the same context structure as chat
    const context: AIContext = {
      currentContent: content,
      characters: [],
      scenes: [],
      chatMode: 'agent', // Force agent mode for tool use
    };

    // Build a focused analysis prompt
    const analysisPrompt = `You are an intelligent screenplay assistant. Carefully analyze this Fountain-format screenplay and perform these actions IN ORDER:

**STEP 1 - Create ALL Scenes:**
Find EVERY scene heading in the screenplay. Scene headings are:
- Lines starting with INT. or EXT. or INT./EXT. or I/E. or EST.
- Lines starting with ! followed by INT. or EXT. (forced scene headings in Fountain)
- Lines starting with . followed by text (forced scene headings)

For EACH scene heading found, call add_scene with the FULL heading text.

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

**STEP 5 - Verify and Clean Up:**
After creating everything:
1. Call list_all_characters to see what exists
2. Call list_all_scenes to see what exists
3. Look for any remaining duplicates or issues
4. Call renumber_scenes if there are gaps in scene numbers

**CRITICAL RULES:**
1. READ THE ENTIRE SCREENPLAY - don't stop early
2. Create EVERY scene, even if similar headings exist
3. Only create actual PEOPLE as characters
4. Identify and MERGE duplicate character names
5. Use the tools - don't just describe what you found
6. VERIFY your work at the end by listing what exists

Start analyzing the screenplay now and call the tools:`;

    // Call the existing chat function which has all the tool execution logic
    console.log('[AI] Calling chat function with analysis prompt...');

    try {
      const response = await this.chat(analysisPrompt, context);
      console.log('[AI] Analysis chat response:', response.content.substring(0, 200));

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

  /**
   * Check if two character names are likely the same person (fuzzy matching)
   * Reserved for future use in automated duplicate detection
   */
  private _areSimilarNames(name1: string, name2: string): boolean {
    // Normalize for comparison
    const normalize = (s: string) => s.replace(/[^A-Z]/g, '');
    const n1 = normalize(name1);
    const n2 = normalize(name2);

    // If one is a subset of the other
    if (n1.includes(n2) || n2.includes(n1)) {
      return Math.abs(n1.length - n2.length) <= 3;
    }

    // Levenshtein distance for similar spellings
    const distance = this._levenshteinDistance(n1, n2);
    const maxLen = Math.max(n1.length, n2.length);

    // Consider similar if distance is <= 20% of length
    return distance <= Math.ceil(maxLen * 0.2);
  }

  /**
   * Calculate Levenshtein distance between two strings
   * Reserved for future use in automated duplicate detection
   */
  private _levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }

    return dp[m][n];
  }
}

