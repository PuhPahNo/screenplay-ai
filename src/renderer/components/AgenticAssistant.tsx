import { useState } from 'react';
import { useAppStore } from '../store/app-store';
import { Bot, Lightbulb, MessageSquare, FileText, Edit, X } from 'lucide-react';

interface AgenticAction {
  type: 'dialogue' | 'expand' | 'rewrite' | 'suggest';
  label: string;
  icon: string;
  description: string;
}

const actionIcons = {
  suggest: Lightbulb,
  dialogue: MessageSquare,
  expand: FileText,
  rewrite: Edit,
};

const actions: AgenticAction[] = [
  {
    type: 'suggest',
    label: 'AI Suggestions',
    icon: '💡',
    description: 'Get smart suggestions for the next line',
  },
  {
    type: 'dialogue',
    label: 'Generate Dialogue',
    icon: '💬',
    description: 'Generate character dialogue',
  },
  {
    type: 'expand',
    label: 'Expand Scene',
    icon: '📝',
    description: 'Expand an outline into a full scene',
  },
  {
    type: 'rewrite',
    label: 'Rewrite',
    icon: '✏️',
    description: 'Rewrite with different tone or style',
  },
];

export default function AgenticAssistant() {
  const { screenplayContent, setScreenplayContent, isAIChatOpen } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [characterName, setCharacterName] = useState('');
  const [sceneContext, setSceneContext] = useState('');
  const [outline, setOutline] = useState('');

  // Hide if AI Chat sidebar is open
  if (isAIChatOpen) {
    return null;
  }

  const handleGenerateDialogue = async () => {
    if (!characterName || !sceneContext) {
      alert('Please provide character name and scene context');
      return;
    }

    setIsProcessing(true);
    try {
      const dialogue = await window.api.ai.generateDialogue(characterName, sceneContext);
      // Insert dialogue at cursor position (simplified - would need editor integration)
      const newContent = screenplayContent + '\n\n' + dialogue;
      setScreenplayContent(newContent);
      alert('Dialogue generated! Check the end of your screenplay.');
      setSelectedAction(null);
    } catch (error) {
      alert('Failed to generate dialogue: ' + error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExpandScene = async () => {
    if (!outline) {
      alert('Please provide a scene outline');
      return;
    }

    setIsProcessing(true);
    try {
      const expandedScene = await window.api.ai.expandScene(outline);
      const newContent = screenplayContent + '\n\n' + expandedScene;
      setScreenplayContent(newContent);
      alert('Scene expanded! Check the end of your screenplay.');
      setSelectedAction(null);
    } catch (error) {
      alert('Failed to expand scene: ' + error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-colors flex items-center justify-center z-50"
        title="AI Assistant"
      >
        <Bot className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 bg-white dark:bg-dark-surface rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border z-50 overflow-hidden">
      {/* Header */}
      <div className="bg-primary-600 text-white p-4 flex items-center justify-between">
        <h3 className="font-semibold">AI Writing Assistant</h3>
        <button
          onClick={() => {
            setIsOpen(false);
            setSelectedAction(null);
          }}
          className="hover:bg-primary-700 rounded p-1"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {!selectedAction ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Choose an AI action to assist with your writing:
            </p>
            {actions.map((action) => {
              const IconComponent = actionIcons[action.type];
              return (
                <button
                  key={action.type}
                  onClick={() => setSelectedAction(action.type)}
                  className="w-full text-left p-3 border border-gray-200 dark:border-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <IconComponent className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    <div>
                      <div className="font-medium text-sm">{action.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {action.description}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={() => setSelectedAction(null)}
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              ← Back
            </button>

            {selectedAction === 'dialogue' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Character Name</label>
                  <input
                    type="text"
                    value={characterName}
                    onChange={(e) => setCharacterName(e.target.value)}
                    placeholder="JOHN"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Scene Context</label>
                  <textarea
                    value={sceneContext}
                    onChange={(e) => setSceneContext(e.target.value)}
                    placeholder="Describe what's happening in the scene..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                </div>
                <button
                  onClick={handleGenerateDialogue}
                  disabled={isProcessing}
                  className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {isProcessing ? 'Generating...' : 'Generate Dialogue'}
                </button>
              </>
            )}

            {selectedAction === 'expand' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Scene Outline</label>
                  <textarea
                    value={outline}
                    onChange={(e) => setOutline(e.target.value)}
                    placeholder="Write a brief outline of what happens in the scene..."
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                </div>
                <button
                  onClick={handleExpandScene}
                  disabled={isProcessing}
                  className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {isProcessing ? 'Expanding...' : 'Expand Scene'}
                </button>
              </>
            )}

            {selectedAction === 'suggest' && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <Lightbulb className="w-12 h-12 mx-auto mb-4 text-primary-500" />
                <p className="text-sm">
                  Position your cursor in the editor where you want suggestions.
                  <br />
                  Press Ctrl+Space for AI suggestions.
                </p>
              </div>
            )}

            {selectedAction === 'rewrite' && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <Edit className="w-12 h-12 mx-auto mb-4 text-primary-500" />
                <p className="text-sm">
                  Select text in the editor, then right-click
                  <br />
                  and choose "Rewrite with AI"
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

