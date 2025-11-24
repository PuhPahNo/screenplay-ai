import { Type, AlignLeft, User, MessageSquare, FileText, ArrowRight, AlignCenter, Lock, Unlock } from 'lucide-react';
import type { ElementType } from '../../shared/types';

interface FormattingToolbarProps {
  currentElement: ElementType;
  isLocked: boolean;
  onElementChange: (type: ElementType) => void;
  onToggleLock: () => void;
}

export default function FormattingToolbar({
  currentElement,
  isLocked,
  onElementChange,
  onToggleLock,
}: FormattingToolbarProps) {
  const elements: Array<{ type: ElementType; label: string; icon: React.ReactNode; shortcut: string; description: string }> = [
    { 
      type: 'scene-heading', 
      label: 'Scene', 
      icon: <FileText className="w-4 h-4" />, 
      shortcut: 'H',
      description: 'Scene heading (e.g., INT. LOCATION - DAY). Starts with INT. or EXT.' 
    },
    { 
      type: 'action', 
      label: 'Action', 
      icon: <AlignLeft className="w-4 h-4" />, 
      shortcut: 'A',
      description: 'Action lines describe what happens on screen. Left-aligned, standard width.' 
    },
    { 
      type: 'character', 
      label: 'Character', 
      icon: <User className="w-4 h-4" />, 
      shortcut: 'C',
      description: 'Character name in UPPERCASE. Appears before dialogue, centered at 3.7".' 
    },
    { 
      type: 'dialogue', 
      label: 'Dialogue', 
      icon: <MessageSquare className="w-4 h-4" />, 
      shortcut: 'D',
      description: 'Character dialogue. Centered column at 2.5" from left, 3.5" wide.' 
    },
    { 
      type: 'parenthetical', 
      label: 'Parenthetical', 
      icon: <Type className="w-4 h-4" />, 
      shortcut: '',
      description: 'Direction within dialogue (e.g., "softly", "turning away"). In parentheses.' 
    },
    { 
      type: 'transition', 
      label: 'Transition', 
      icon: <ArrowRight className="w-4 h-4" />, 
      shortcut: '',
      description: 'Scene transitions (e.g., CUT TO:, FADE OUT.). Right-aligned, uppercase.' 
    },
    { 
      type: 'centered', 
      label: 'Centered', 
      icon: <AlignCenter className="w-4 h-4" />, 
      shortcut: '',
      description: 'Centered text for titles, montages, or special formatting.' 
    },
  ];

  return (
    <div className="flex items-center gap-1 bg-white dark:bg-dark-surface border-b-2 border-gray-200 dark:border-dark-border px-4 py-3 shadow-sm">
      <div className="flex items-center gap-1 border-r-2 border-gray-200 dark:border-dark-border pr-4 mr-3">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 mr-2">Format:</span>
        {elements.map((element) => (
          <button
            key={element.type}
            onClick={() => onElementChange(element.type)}
            className={`px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 flex items-center gap-1.5 border ${
              currentElement === element.type
                ? 'bg-primary-600 text-white shadow-md border-primary-700'
                : 'bg-gray-50 dark:bg-dark-bg text-gray-700 dark:text-gray-300 border-gray-200 dark:border-dark-border hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-300 dark:hover:border-primary-700'
            }`}
            title={`${element.description}${element.shortcut ? ` (⌘⇧${element.shortcut})` : ''}`}
          >
            {element.icon}
            <span className="hidden sm:inline">{element.label}</span>
            {element.shortcut && (
              <span className="text-[10px] opacity-70 ml-1">⌘⇧{element.shortcut}</span>
            )}
          </button>
        ))}
      </div>

      <button
        onClick={onToggleLock}
        className={`px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 flex items-center gap-1.5 border ${
          isLocked
            ? 'bg-amber-500 text-white shadow-md border-amber-600'
            : 'bg-gray-50 dark:bg-dark-bg text-gray-700 dark:text-gray-300 border-gray-200 dark:border-dark-border hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-300'
        }`}
        title={isLocked 
          ? 'Format is locked. Press Tab or click to unlock and allow automatic formatting.' 
          : 'Auto-formatting enabled. Press Tab to cycle formats, or click to lock current format.'}
      >
        {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        <span className="hidden sm:inline">{isLocked ? 'Locked' : 'Auto'}</span>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
          Press <kbd className="px-2 py-1 bg-gray-100 dark:bg-dark-bg rounded text-[10px] font-mono border border-gray-300 dark:border-dark-border">Tab</kbd> to cycle formats
        </span>
      </div>
    </div>
  );
}

