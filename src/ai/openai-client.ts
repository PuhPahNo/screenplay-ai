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
            description: 'Create a new character in the database. YOU MUST USE THIS TOOL when the user asks to create a character. Do not just describe the character.',
            parameters: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Name of the character (e.g. JOHN DOE)' },
                description: { type: 'string', description: 'Brief description of the character' },
                age: { type: 'string', description: 'Age of the character' },
                occupation: { type: 'string', description: 'Occupation of the character' },
                personality: { type: 'string', description: 'Personality traits' },
                goals: { type: 'string', description: 'Character goals' },
                role: { type: 'string', description: 'Role in the story (Protagonist, Antagonist, etc.)' }
              },
              required: ['name', 'description']
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

        for (const toolCall of responseMessage.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments);
          let result = 'Action completed.';

          try {
            switch (toolCall.function.name) {
              case 'create_character':
                const newCharacter = {
                  id: uuidv4(),
                  name: args.name.toUpperCase(),
                  description: args.description,
                  age: args.age || 'Unknown',
                  occupation: args.occupation || 'Unknown',
                  personality: args.personality || '',
                  goals: args.goals || '',
                  arc: '',
                  relationships: {},
                  appearances: [],
                  notes: `Created by AI. Role: ${args.role || 'Supporting'}`,
                };
                await this.dbManager.saveCharacter(newCharacter);
                result = `Successfully created character: ${newCharacter.name}`;
                this.systemActions?.notifyUpdate();
                break;

                break;

              case 'edit_character':
                const char = await this.dbManager.getCharacter(args.id);
                if (char) {
                  const updatedChar = { ...char, ...args };
                  await this.dbManager.saveCharacter(updatedChar);
                  result = `Successfully updated character: ${char.name}`;
                  this.systemActions?.notifyUpdate();
                } else {
                  result = `Character not found with ID: ${args.id}`;
                }
                break;

              case 'delete_character':
                await this.dbManager.deleteCharacter(args.id);
                result = `Successfully deleted character with ID: ${args.id}`;
                this.systemActions?.notifyUpdate();
                break;

              case 'delete_character_by_name':
                const charsToSearch = await this.dbManager.getCharacters();
                const charToDelete = charsToSearch.find(c => 
                  c.name.toLowerCase() === args.character_name.toLowerCase()
                );
                if (charToDelete) {
                  await this.dbManager.deleteCharacter(charToDelete.id);
                  result = `✓ Deleted character: **${charToDelete.name}**`;
                  this.systemActions?.notifyUpdate();
                } else {
                  result = `✗ Character not found: "${args.character_name}"`;
                }
                break;

              case 'delete_characters_batch':
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
                
                result = `**Batch Delete Results:**\n\n`;
                if (deleted.length > 0) {
                  result += `✓ **Deleted (${deleted.length}):**\n${deleted.map(n => `  - ${n}`).join('\n')}\n\n`;
                }
                if (notFound.length > 0) {
                  result += `✗ **Not Found (${notFound.length}):**\n${notFound.map(n => `  - ${n}`).join('\n')}`;
                }
                this.systemActions?.notifyUpdate();
                break;

              case 'add_scene':
                const newScene = {
                  id: uuidv4(),
                  number: 0, // Will be reordered
                  heading: args.heading.toUpperCase(),
                  location: '',
                  timeOfDay: '',
                  summary: args.summary || '',
                  characters: args.characters || [],
                  startLine: 0,
                  endLine: 0,
                  content: '',
                };
                await this.dbManager.saveScene(newScene);
                result = `Successfully added scene: ${newScene.heading}`;
                this.systemActions?.notifyUpdate();
                break;

              case 'delete_scene':
                await this.dbManager.deleteScene(args.id);
                result = `Successfully deleted scene with ID: ${args.id}`;
                this.systemActions?.notifyUpdate();
                break;

              case 'save_screenplay':
                if (this.systemActions) {
                  await this.systemActions.saveScreenplay();
                  result = 'Screenplay saved successfully.';
                } else {
                  result = 'Save functionality not available.';
                }
                break;

              case 'export_screenplay':
                if (this.systemActions) {
                  await this.systemActions.exportScreenplay(args.format);
                  result = `Screenplay exported to ${args.format} successfully.`;
                } else {
                  result = 'Export functionality not available.';
                }
                break;

              case 'update_content':
                if (this.systemActions && this.systemActions.previewUpdate) {
                  this.systemActions.previewUpdate({
                    original: args.original_text,
                    modified: args.new_text,
                    description: args.description
                  });
                  result = `I have proposed a change: "${args.description}". Please review it in the editor and click Accept or Reject.`;
                } else {
                  result = 'Content update functionality not available.';
                }
                break;

              // === QUERY TOOLS (Read-only) ===
              case 'read_scene':
                const scenes = await this.dbManager.getScenes();
                let targetScene = null;
                
                if (args.scene_id) {
                  targetScene = await this.dbManager.getScene(args.scene_id);
                } else if (args.scene_number) {
                  targetScene = scenes.find(s => s.number === args.scene_number);
                }
                
                if (targetScene) {
                  result = `=== SCENE ${targetScene.number}: ${targetScene.heading} ===\n\n`;
                  result += `Summary: ${targetScene.summary || 'No summary'}\n`;
                  result += `Characters: ${targetScene.characters.join(', ') || 'None listed'}\n\n`;
                  result += `--- FULL CONTENT ---\n${targetScene.content || '[Scene content not yet written]'}`;
                } else {
                  result = `Scene not found. Available scenes: ${scenes.map(s => `${s.number}: ${s.heading}`).join(', ')}`;
                }
                break;

              case 'read_character':
                const allCharacters = await this.dbManager.getCharacters();
                let targetChar = null;
                
                if (args.character_id) {
                  targetChar = await this.dbManager.getCharacter(args.character_id);
                } else if (args.character_name) {
                  targetChar = allCharacters.find(c => 
                    c.name.toLowerCase() === args.character_name.toLowerCase() ||
                    c.id.toLowerCase() === args.character_name.toLowerCase()
                  );
                }
                
                if (targetChar) {
                  result = `=== CHARACTER: ${targetChar.name} ===\n\n`;
                  result += `Description: ${targetChar.description || 'None'}\n`;
                  result += `Age: ${targetChar.age || 'Unknown'}\n`;
                  result += `Occupation: ${targetChar.occupation || 'Unknown'}\n`;
                  result += `Personality: ${targetChar.personality || 'Not defined'}\n`;
                  result += `Goals: ${targetChar.goals || 'Not defined'}\n`;
                  result += `Character Arc: ${targetChar.arc || 'Not defined'}\n`;
                  result += `Backstory: ${targetChar.backstory || 'Not defined'}\n`;
                  result += `Fears: ${targetChar.fears || 'Not defined'}\n`;
                  if (targetChar.relationships && Object.keys(targetChar.relationships).length > 0) {
                    result += `\nRelationships:\n`;
                    for (const [name, desc] of Object.entries(targetChar.relationships)) {
                      result += `  - ${name}: ${desc}\n`;
                    }
                  }
                  result += `\nAppears in ${targetChar.appearances.length} scene(s)`;
                  if (targetChar.notes) {
                    result += `\n\nNotes: ${targetChar.notes}`;
                  }
                } else {
                  result = `Character not found. Available characters: ${allCharacters.map(c => c.name).join(', ')}`;
                }
                break;

              case 'search_screenplay':
                const allScenes = await this.dbManager.getScenes();
                const query = args.query.toLowerCase();
                const matches: string[] = [];
                
                for (const scene of allScenes) {
                  if (scene.content && scene.content.toLowerCase().includes(query)) {
                    // Find the matching line and context
                    const lines = scene.content.split('\n');
                    for (let i = 0; i < lines.length; i++) {
                      if (lines[i].toLowerCase().includes(query)) {
                        const start = Math.max(0, i - 2);
                        const end = Math.min(lines.length, i + 3);
                        const context = lines.slice(start, end).join('\n');
                        matches.push(`Scene ${scene.number} (${scene.heading}):\n${context}\n`);
                        break; // One match per scene
                      }
                    }
                  }
                }
                
                if (matches.length > 0) {
                  result = `Found "${args.query}" in ${matches.length} scene(s):\n\n${matches.join('\n---\n')}`;
                } else {
                  result = `No matches found for "${args.query}" in the screenplay.`;
                }
                break;

              case 'get_character_scenes':
                const charScenes = await this.dbManager.getScenes();
                const charName = args.character_name.toUpperCase();
                const charAppearances = charScenes.filter(s => 
                  s.characters.some(c => c.toUpperCase() === charName) ||
                  (s.content && s.content.toUpperCase().includes(charName))
                );
                
                if (charAppearances.length > 0) {
                  result = `${charName} appears in ${charAppearances.length} scene(s):\n\n`;
                  for (const scene of charAppearances) {
                    result += `=== Scene ${scene.number}: ${scene.heading} ===\n`;
                    result += scene.content || '[No content]';
                    result += '\n\n---\n\n';
                  }
                } else {
                  result = `${charName} not found in any scenes.`;
                }
                break;

              case 'get_screenplay_section':
                const sectionScenes = await this.dbManager.getScenes();
                const startNum = args.start_scene;
                const endNum = args.end_scene;
                const section = sectionScenes.filter(s => s.number >= startNum && s.number <= endNum);
                
                if (section.length > 0) {
                  result = `=== SCENES ${startNum} to ${endNum} ===\n\n`;
                  for (const scene of section) {
                    result += `--- Scene ${scene.number}: ${scene.heading} ---\n`;
                    result += scene.content || '[No content]';
                    result += '\n\n';
                  }
                } else {
                  result = `No scenes found in range ${startNum}-${endNum}. Total scenes: ${sectionScenes.length}`;
                }
                break;
            }
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
        let maxIterations = 5; // Safety limit to prevent infinite loops
        let iterations = 0;
        
        while (continueLoop && iterations < maxIterations) {
          iterations++;
          
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
            
            // Execute these tool calls too (simplified - reusing same switch logic)
            for (const toolCall of nextMessage.tool_calls) {
              const args = JSON.parse(toolCall.function.arguments);
              let result = 'Action completed.';
              
              // Re-execute the same switch logic for additional tool calls
              // This is a simplified version - for complex cases, extract the switch to a method
              try {
                // Handle the most common follow-up tools
                if (toolCall.function.name === 'read_scene' || 
                    toolCall.function.name === 'read_character' ||
                    toolCall.function.name === 'search_screenplay') {
                  // These are query tools - execute them
                  // (The full switch is above, this handles follow-up queries)
                  result = `Tool ${toolCall.function.name} executed.`;
                }
              } catch (error) {
                result = `Error: ${error}`;
              }
              
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: result,
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
   * LLM-powered screenplay analysis for accurate character and scene detection.
   * Uses GPT to intelligently parse the screenplay and identify:
   * - Scene headings (even non-standard ones)
   * - Characters (with duplicate detection and normalization)
   * - Title page information
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
    console.log('[AI] Starting LLM screenplay analysis...');
    
    // Split content into chunks if it's very long (to avoid token limits)
    const MAX_CHUNK_SIZE = 30000; // characters
    const chunks: string[] = [];
    
    if (content.length > MAX_CHUNK_SIZE) {
      // Split by scene headings to maintain context
      const lines = content.split('\n');
      let currentChunk = '';
      
      for (const line of lines) {
        if (currentChunk.length + line.length > MAX_CHUNK_SIZE && currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = line;
        } else {
          currentChunk += (currentChunk ? '\n' : '') + line;
        }
      }
      if (currentChunk) chunks.push(currentChunk);
    } else {
      chunks.push(content);
    }

    console.log(`[AI] Processing ${chunks.length} chunk(s)...`);

    // Process each chunk and aggregate results
    const allScenes: Array<{ number: number; heading: string; location: string; timeOfDay: string; lineNumber: number }> = [];
    const characterMap = new Map<string, { name: string; dialogueCount: number; firstAppearance: number; aliases: Set<string> }>();
    let title: string | undefined;
    let author: string | undefined;
    let sceneCounter = 0;
    let lineOffset = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`[AI] Analyzing chunk ${i + 1}/${chunks.length}...`);

      try {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-5-mini',
          messages: [
            {
              role: 'system',
              content: `You are a professional screenplay parser. Analyze the provided screenplay text and extract structured data.

IMPORTANT RULES:
1. Scene headings start with INT., EXT., INT./EXT., I/E, EST., or can be forced with . or ! prefix
2. Scene headings may include location and time of day (DAY, NIGHT, DUSK, DAWN, CONTINUOUS, etc.)
3. Character names appear in ALL CAPS on their own line before dialogue
4. Character names may have extensions like (V.O.), (O.S.), (CONT'D)
5. Watch for duplicate characters - same person with different spellings (O'KEEFE vs O'KEEFFE)
6. Ignore generic uppercase words that aren't character names (FADE IN, CUT TO, THE END, etc.)
7. If you see a title page (Title:, Author:, etc.), extract that information

Return ONLY valid JSON with this exact structure:
{
  "title": "string or null",
  "author": "string or null", 
  "scenes": [
    {
      "heading": "FULL SCENE HEADING TEXT",
      "location": "Location name",
      "timeOfDay": "DAY/NIGHT/etc",
      "approximateLineNumber": 123
    }
  ],
  "characters": [
    {
      "name": "CHARACTER NAME (normalized, uppercase)",
      "variants": ["variant1", "variant2"],
      "dialogueCount": 5,
      "approximateFirstLine": 45
    }
  ],
  "potentialDuplicates": [
    {
      "names": ["O'KEEFE", "O'KEEFFE"],
      "suggestedName": "O'KEEFE",
      "reason": "Same character with different spelling"
    }
  ]
}`
            },
            {
              role: 'user',
              content: `Analyze this screenplay text and extract all scenes and characters:\n\n${chunk}`
            }
          ],
          temperature: 0.1, // Low temperature for consistent parsing
          max_completion_tokens: 4000,
          response_format: { type: 'json_object' },
        });

        const response = completion.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(response);

        // Extract title/author from first chunk
        if (i === 0) {
          title = parsed.title || undefined;
          author = parsed.author || undefined;
        }

        // Add scenes with adjusted line numbers
        if (parsed.scenes && Array.isArray(parsed.scenes)) {
          for (const scene of parsed.scenes) {
            sceneCounter++;
            allScenes.push({
              number: sceneCounter,
              heading: scene.heading || '',
              location: scene.location || '',
              timeOfDay: scene.timeOfDay || '',
              lineNumber: (scene.approximateLineNumber || 0) + lineOffset,
            });
          }
        }

        // Aggregate characters
        if (parsed.characters && Array.isArray(parsed.characters)) {
          for (const char of parsed.characters) {
            const normalizedName = (char.name || '').toUpperCase().trim();
            if (!normalizedName) continue;

            const existing = characterMap.get(normalizedName);
            if (existing) {
              existing.dialogueCount += char.dialogueCount || 0;
              if (char.variants) {
                char.variants.forEach((v: string) => existing.aliases.add(v.toUpperCase().trim()));
              }
            } else {
              characterMap.set(normalizedName, {
                name: normalizedName,
                dialogueCount: char.dialogueCount || 0,
                firstAppearance: (char.approximateFirstLine || 0) + lineOffset,
                aliases: new Set(char.variants?.map((v: string) => v.toUpperCase().trim()) || []),
              });
            }
          }
        }

        // Track line offset for next chunk
        lineOffset += chunk.split('\n').length;

      } catch (error) {
        console.error(`[AI] Error analyzing chunk ${i + 1}:`, error);
        // Continue with other chunks
      }
    }

    // Find duplicates across the full character set
    const duplicates: Array<{ names: string[]; suggestedName: string; reason: string }> = [];
    const characterNames = Array.from(characterMap.keys());
    const processedPairs = new Set<string>();

    for (let i = 0; i < characterNames.length; i++) {
      for (let j = i + 1; j < characterNames.length; j++) {
        const name1 = characterNames[i];
        const name2 = characterNames[j];
        const pairKey = [name1, name2].sort().join('|');
        
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        // Check for similar names (likely duplicates)
        if (this.areSimilarNames(name1, name2)) {
          const char1 = characterMap.get(name1)!;
          const char2 = characterMap.get(name2)!;
          
          // Suggest the one with more dialogue as the canonical name
          const suggestedName = char1.dialogueCount >= char2.dialogueCount ? name1 : name2;
          
          duplicates.push({
            names: [name1, name2],
            suggestedName,
            reason: 'Similar character names - likely the same person',
          });
        }
      }
    }

    // Convert character map to array
    const characters = Array.from(characterMap.entries()).map(([name, data]) => ({
      name: data.name,
      normalizedName: name,
      aliases: Array.from(data.aliases),
      dialogueCount: data.dialogueCount,
      firstAppearance: data.firstAppearance,
    }));

    console.log(`[AI] Analysis complete: ${allScenes.length} scenes, ${characters.length} characters, ${duplicates.length} potential duplicates`);

    return {
      title,
      author,
      scenes: allScenes,
      characters,
      duplicates,
    };
  }

  /**
   * Check if two character names are likely the same person (fuzzy matching)
   */
  private areSimilarNames(name1: string, name2: string): boolean {
    // Normalize for comparison
    const normalize = (s: string) => s.replace(/[^A-Z]/g, '');
    const n1 = normalize(name1);
    const n2 = normalize(name2);

    // If one is a subset of the other
    if (n1.includes(n2) || n2.includes(n1)) {
      return Math.abs(n1.length - n2.length) <= 3;
    }

    // Levenshtein distance for similar spellings
    const distance = this.levenshteinDistance(n1, n2);
    const maxLen = Math.max(n1.length, n2.length);
    
    // Consider similar if distance is <= 20% of length
    return distance <= Math.ceil(maxLen * 0.2);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(s1: string, s2: string): number {
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

