import OpenAI from 'openai';
import type { AIMessage } from '../shared/types';

const SUMMARIZATION_PROMPT = `You are a conversation summarizer for a screenplay writing assistant. Your job is to create a concise but comprehensive summary of a conversation that preserves all critical information the AI needs to continue helping effectively.

The summary MUST preserve:
1. CURRENT TASK: What the user is currently working on or asking about
2. KEY DECISIONS: Any edits accepted or rejected, important creative choices made
3. USER PREFERENCES: Style, tone, pacing, or thematic preferences the user has expressed
4. CHARACTER NOTES: Important details about characters discussed
5. PLOT POINTS: Any story decisions or plot elements discussed
6. REJECTED IDEAS: Suggestions that were rejected (so they won't be repeated)

Format the summary as a structured document with clear sections. Be concise but complete - this summary will replace the full conversation history.`;

export interface SummarizationResult {
  summary: string;
  originalMessageCount: number;
  preservedMessageCount: number;
}

export class ContextSummarizer {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Estimate token count for a string (rough approximation)
   * GPT models use ~4 characters per token on average
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimate total tokens for messages array
   */
  estimateMessagesTokens(messages: AIMessage[]): number {
    let total = 0;
    for (const msg of messages) {
      total += this.estimateTokens(msg.content);
      // Add overhead for role, timestamps, etc.
      total += 20;
    }
    return total;
  }

  /**
   * Check if summarization is needed based on token threshold
   */
  needsSummarization(messages: AIMessage[], threshold: number = 180000): boolean {
    return this.estimateMessagesTokens(messages) > threshold;
  }

  /**
   * Summarize older messages while keeping recent ones intact
   * @param messages All conversation messages
   * @param keepRecentCount Number of recent messages to keep intact (default 15)
   */
  async summarize(
    messages: AIMessage[],
    keepRecentCount: number = 15
  ): Promise<SummarizationResult> {
    // Separate recent messages from older ones - olderMessages get summarized, rest preserved
    const olderMessages = messages.slice(0, -keepRecentCount);

    if (olderMessages.length === 0) {
      return {
        summary: '',
        originalMessageCount: messages.length,
        preservedMessageCount: messages.length,
      };
    }

    // Build conversation text for summarization
    const conversationText = olderMessages
      .map(msg => `[${msg.role.toUpperCase()}]: ${msg.content}`)
      .join('\n\n');

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: SUMMARIZATION_PROMPT,
          },
          {
            role: 'user',
            content: `Please summarize the following conversation between a user and an AI screenplay assistant:\n\n${conversationText}`,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent summaries
        max_completion_tokens: 2000,
      });

      const summary = completion.choices[0]?.message?.content || '';

      return {
        summary,
        originalMessageCount: messages.length,
        preservedMessageCount: keepRecentCount,
      };
    } catch (error) {
      console.error('Failed to summarize conversation:', error);
      throw error;
    }
  }

  /**
   * Build context prompt with summary for use in AI calls
   * @param summary Previous conversation summary
   * @param recentMessages Recent messages that weren't summarized
   */
  buildContextWithSummary(summary: string, _recentMessages: AIMessage[]): string {
    let context = '';

    if (summary) {
      context += '## PREVIOUS CONVERSATION SUMMARY\n';
      context += '(This summarizes earlier parts of our conversation)\n\n';
      context += summary;
      context += '\n\n---\n\n';
      context += '## RECENT CONVERSATION\n';
      context += '(Continue from here)\n\n';
    }

    return context;
  }
}

