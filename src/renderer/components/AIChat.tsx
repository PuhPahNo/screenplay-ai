import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useAppStore } from '../store/app-store';
import { Bot, X, Send } from 'lucide-react';

export default function AIChat() {
  const { aiHistory, sendAIMessage, toggleAIChat } = useAppStore();
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiHistory]);

  const handleSend = async () => {
    if (!message.trim() || isSending) return;

    const userMessage = message.trim();
    setMessage('');
    setIsSending(true);

    // Optimistic update: Add user message to UI immediately
    const tempId = Date.now().toString();
    useAppStore.setState(state => ({
      aiHistory: [
        ...state.aiHistory,
        {
          id: tempId,
          role: 'user',
          content: userMessage,
          timestamp: Date.now()
        }
      ]
    }));

    try {
      await sendAIMessage(userMessage);
      // The store update in sendAIMessage will replace our optimistic one
    } catch (error) {
      console.error('Failed to send message:', error);
      // Revert optimistic update on error (optional, but good practice)
      useAppStore.setState(state => ({
        aiHistory: state.aiHistory.filter(msg => msg.id !== tempId)
      }));
      alert('Failed to send message: ' + error);
      setMessage(userMessage); // Restore message to input
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-dark-surface">
      {/* Header */}
      <div className="h-12 border-b border-gray-200 dark:border-dark-border flex items-center justify-between px-4">
        <h3 className="font-semibold">AI Assistant</h3>
        <button
          onClick={toggleAIChat}
          className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {aiHistory.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <Bot className="w-12 h-12 mx-auto mb-4 text-primary-500" />
            <p className="text-sm">Ask me anything about your screenplay!</p>
            <div className="mt-6 space-y-2 text-xs">
              <p className="font-medium">Try asking:</p>
              <p>"Develop a character arc for John"</p>
              <p>"What's the pacing of Act 2?"</p>
              <p>"Suggest dialogue for the opening scene"</p>
            </div>
          </div>
        ) : (
          aiHistory
            .filter((msg) => msg.role !== 'system')
            .map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2 ${msg.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-dark-bg text-gray-800 dark:text-gray-200'
                    }`}
                >
                  <div className={`text-sm prose dark:prose-invert max-w-none ${msg.role === 'user' ? 'text-white prose-headings:text-white prose-strong:text-white' : ''}`}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  {msg.contextUsed && (
                    <div className="mt-2 pt-2 border-t border-white/20 text-xs opacity-70">
                      Context: {msg.contextUsed.characters.length} characters,{' '}
                      {msg.contextUsed.scenes.length} scenes
                    </div>
                  )}
                </div>
              </div>
            ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-dark-border p-4">
        <div className="flex gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about characters, scenes, or storyline..."
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            rows={3}
            disabled={isSending}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || isSending}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end flex items-center gap-2"
          >
            {isSending ? 'Sending...' : (
              <>
                <Send className="w-4 h-4" />
                Send
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

