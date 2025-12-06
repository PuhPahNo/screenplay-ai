import { useState, useEffect, useRef, memo, useCallback, useMemo, startTransition } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAppStore } from '../store/app-store';
import { 
  Bot, X, Send, Plus, Trash2, MessageSquare, 
  ChevronLeft, ChevronRight, Loader2, BarChart3, ChevronUp
} from 'lucide-react';
import type { Conversation, AIMessage } from '../../shared/types';

// Helper to format token counts (e.g., 1234 -> "1.2k")
function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return (tokens / 1000).toFixed(1) + 'k';
  }
  return tokens.toString();
}

// Helper to format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// Group conversations by time period
function groupConversations(conversations: Conversation[]) {
  const today = new Date().setHours(0, 0, 0, 0);
  const yesterday = today - 86400000;
  const weekAgo = today - 7 * 86400000;

  const groups: { label: string; conversations: Conversation[] }[] = [
    { label: 'Today', conversations: [] },
    { label: 'Yesterday', conversations: [] },
    { label: 'Previous 7 Days', conversations: [] },
    { label: 'Older', conversations: [] },
  ];

  conversations.forEach(conv => {
    if (conv.updatedAt >= today) {
      groups[0].conversations.push(conv);
    } else if (conv.updatedAt >= yesterday) {
      groups[1].conversations.push(conv);
    } else if (conv.updatedAt >= weekAgo) {
      groups[2].conversations.push(conv);
    } else {
      groups[3].conversations.push(conv);
    }
  });

  return groups.filter(g => g.conversations.length > 0);
}

// Memoized message bubble component to prevent re-renders
// Key optimization: Only parse markdown for assistant messages, user messages are plain text
const MessageBubble = memo(function MessageBubble({ 
  msg, 
  formatTokens 
}: { 
  msg: AIMessage; 
  formatTokens: (tokens: number) => string;
}) {
  // User messages are typically plain text - skip expensive markdown parsing
  const isUser = msg.role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-primary-600 text-white'
            : 'bg-gray-100 dark:bg-dark-bg text-gray-800 dark:text-gray-200'
        }`}
      >
        {isUser ? (
          // User messages: Simple text rendering (much faster)
          <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
        ) : (
          // Assistant messages: Full markdown rendering
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none 
            prose-p:my-2 prose-p:leading-relaxed
            prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-2
            prose-ul:my-2 prose-li:my-0.5
            prose-strong:font-semibold
            prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-gray-200 dark:prose-code:bg-gray-700
            prose-p:text-gray-800 dark:prose-p:text-gray-200">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          </div>
        )}
        {/* Token usage for AI responses */}
        {!isUser && msg.tokenUsage && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <BarChart3 className="w-3 h-3" />
            <span>{formatTokens(msg.tokenUsage.promptTokens)} in</span>
            <span>·</span>
            <span>{formatTokens(msg.tokenUsage.completionTokens)} out</span>
            <span>·</span>
            <span>{formatTokens(msg.tokenUsage.totalTokens)} total</span>
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if the message content actually changed
  return prevProps.msg.id === nextProps.msg.id && 
         prevProps.msg.content === nextProps.msg.content;
});

// How many messages to show initially (recent ones)
const INITIAL_MESSAGES_TO_SHOW = 20;

export default function AIChat() {
  const { 
    aiHistory, 
    sendAIMessage, 
    toggleAIChat,
    conversations,
    currentConversationId,
    isLoadingConversations,
    loadConversations,
    createConversation,
    deleteConversation,
    selectConversation,
    chatMode,
    setChatMode,
  } = useAppStore();

  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false); // Collapsed by default for more chat space
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [hoveredConvId, setHoveredConvId] = useState<string | null>(null);
  const [showAllMessages, setShowAllMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Filter and limit messages for performance
  const filteredMessages = useMemo(() => {
    return aiHistory.filter((msg) => msg.role !== 'system');
  }, [aiHistory]);
  
  const visibleMessages = useMemo(() => {
    if (showAllMessages || filteredMessages.length <= INITIAL_MESSAGES_TO_SHOW) {
      return filteredMessages;
    }
    // Show the most recent messages
    return filteredMessages.slice(-INITIAL_MESSAGES_TO_SHOW);
  }, [filteredMessages, showAllMessages]);
  
  const hiddenMessageCount = filteredMessages.length - visibleMessages.length;
  
  // Memoized formatTokens function
  const formatTokensCallback = useCallback(formatTokens, []);

  // Load conversations on mount
  useEffect(() => {
    const initializeChat = async () => {
      await loadConversations();
      
      // After loading, if no current conversation and we have conversations, select the first one
      const state = useAppStore.getState();
      if (!state.currentConversationId && state.conversations.length > 0) {
        await selectConversation(state.conversations[0].id);
      }
    };
    
    initializeChat();
  }, []);
  
  // Reset "show all" when switching conversations
  useEffect(() => {
    setShowAllMessages(false);
  }, [currentConversationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiHistory]);

  const handleSend = async () => {
    if (!message.trim() || isSending) return;

    const userMessage = message.trim();
    setMessage('');
    setIsSending(true);

    // The store's sendAIMessage handles the optimistic UI update
    try {
      await sendAIMessage(userMessage);
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message: ' + error);
      setMessage(userMessage);
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

  const handleNewChat = async () => {
    await createConversation('New Chat');
  };

  const handleDeleteConversation = async (id: string) => {
    await deleteConversation(id);
    setDeleteConfirmId(null);
  };

  const groupedConversations = groupConversations(conversations);

  return (
    <div className="h-full flex bg-white dark:bg-dark-surface">
      {/* Main Chat Area - Now on left */}
      <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="h-12 border-b border-gray-200 dark:border-dark-border flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
        <button
          onClick={toggleAIChat}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          <X className="w-5 h-5" />
            </button>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              {currentConversationId 
                ? conversations.find(c => c.id === currentConversationId)?.title || 'AI Assistant'
                : 'AI Assistant'
              }
            </h3>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Ask/Agent Mode Toggle */}
            <div className="flex rounded-lg bg-gray-100 dark:bg-dark-bg p-0.5">
              <button
                onClick={() => setChatMode('ask')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  chatMode === 'ask'
                    ? 'bg-white dark:bg-dark-surface text-primary-600 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                title="Ask mode: Get advice and analysis (no actions)"
              >
                Ask
              </button>
              <button
                onClick={() => setChatMode('agent')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  chatMode === 'agent'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                title="Agent mode: Take actions (create, edit, delete)"
              >
                Agent
        </button>
            </div>
            
            {!showSidebar && (
              <button
                onClick={() => setShowSidebar(true)}
                className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                title="Show conversations"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
          </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {filteredMessages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <Bot className="w-12 h-12 mx-auto mb-4 text-primary-500" />
              <p className="text-sm font-medium">Start a conversation</p>
              <p className="text-xs mt-2 max-w-xs mx-auto">
                Ask me anything about your screenplay - characters, plot, dialogue, or structure.
              </p>
              <div className="mt-6 space-y-2">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Try asking:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    'Analyze my protagonist',
                    'Check scene pacing',
                    'Suggest dialogue',
                    'Find plot holes',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setMessage(suggestion)}
                      className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-dark-bg hover:bg-gray-200 dark:hover:bg-dark-border rounded-full transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Load more button for long conversations */}
              {hiddenMessageCount > 0 && (
                <button
                  onClick={() => startTransition(() => setShowAllMessages(true))}
                  className="w-full py-2 px-4 text-xs text-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 dark:bg-dark-bg rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <ChevronUp className="w-4 h-4" />
                  Load {hiddenMessageCount} older messages
                </button>
              )}
              {visibleMessages.map((msg) => (
                <MessageBubble 
                  key={msg.id} 
                  msg={msg} 
                  formatTokens={formatTokensCallback}
                />
              ))}
            </>
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
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-dark-border rounded-xl bg-white dark:bg-dark-bg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-shadow"
              rows={2}
            disabled={isSending}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || isSending}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-end"
            >
              {isSending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Conversation Sidebar - Now on right */}
      {showSidebar && (
        <div className="w-52 flex-shrink-0 border-l border-gray-200 dark:border-dark-border flex flex-col bg-gray-50 dark:bg-dark-bg">
          {/* Sidebar Header */}
          <div className="p-3 border-b border-gray-200 dark:border-dark-border">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </button>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {isLoadingConversations ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8 px-4 text-gray-500 dark:text-gray-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No conversations yet</p>
                <p className="text-xs mt-1">Start a new chat!</p>
              </div>
            ) : (
              <div className="py-2">
                {groupedConversations.map((group) => (
                  <div key={group.label} className="mb-2">
                    <div className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {group.label}
                    </div>
                    {group.conversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={`relative group mx-2 rounded-lg transition-colors ${
                          conv.id === currentConversationId
                            ? 'bg-primary-100 dark:bg-primary-900/30'
                            : 'hover:bg-gray-100 dark:hover:bg-dark-surface'
                        }`}
                        onMouseEnter={() => setHoveredConvId(conv.id)}
                        onMouseLeave={() => {
                          setHoveredConvId(null);
                          if (deleteConfirmId === conv.id) setDeleteConfirmId(null);
                        }}
                      >
                        <button
                          onClick={() => selectConversation(conv.id)}
                          className="w-full text-left px-3 py-2"
                        >
                          <div className={`text-sm truncate ${
                            conv.id === currentConversationId
                              ? 'text-primary-700 dark:text-primary-300 font-medium'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}>
                            {conv.title}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            <span>{formatRelativeTime(conv.updatedAt)}</span>
                            {conv.totalTokensUsed && conv.totalTokensUsed > 0 && (
                              <>
                                <span>·</span>
                                <span>{formatTokens(conv.totalTokensUsed)}</span>
                              </>
                            )}
                          </div>
                        </button>

                        {/* Delete button */}
                        {hoveredConvId === conv.id && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            {deleteConfirmId === conv.id ? (
                              <button
                                onClick={() => handleDeleteConversation(conv.id)}
                                className="px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                              >
                                Delete
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(conv.id);
                                }}
                                className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Collapse Button */}
          <div className="p-2 border-t border-gray-200 dark:border-dark-border">
            <button
              onClick={() => setShowSidebar(false)}
              className="w-full flex items-center justify-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Hide
              <ChevronRight className="w-4 h-4" />
          </button>
          </div>
        </div>
      )}
    </div>
  );
}
