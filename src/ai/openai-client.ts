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

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-5-mini',
        messages,
        tools,
        tool_choice: 'auto',
        parallel_tool_calls: true,  // Allow multiple tool calls in one response
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

        const secondResponse = await this.openai.chat.completions.create({
          model: 'gpt-5-mini',
          messages,
        });

        // Track token usage from second completion (after tool calls)
        if (secondResponse.usage) {
          totalPromptTokens += secondResponse.usage.prompt_tokens;
          totalCompletionTokens += secondResponse.usage.completion_tokens;
        }

        return {
          content: secondResponse.choices[0]?.message?.content || 'Action completed.',
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
}

