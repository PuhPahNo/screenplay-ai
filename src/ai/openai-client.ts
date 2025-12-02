import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import type { AIContext, Storyline, SystemActions } from '../shared/types';
import type { DatabaseManager } from '../database/db-manager';
import { ContextBuilder } from './context-builder';

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

  async chat(message: string, context: AIContext): Promise<string> {
    try {
      const systemPrompt = this.contextBuilder.buildSystemPrompt(context);
      const contextPrompt = this.contextBuilder.buildContextPrompt(context);

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
            description: 'Delete a character from the database.',
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
        temperature: 0.7,
        max_completion_tokens: 4000,
      });

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
          temperature: 0.7,
        });

        return secondResponse.choices[0]?.message?.content || 'Action completed.';
      }

      return responseMessage?.content || 'No response generated.';
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
        temperature: 0.7,
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
        temperature: 0.7,
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

