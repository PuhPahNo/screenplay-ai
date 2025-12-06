import { useState, useEffect } from 'react';
import { X, AlertTriangle, Check, Merge, Trash2, Loader2 } from 'lucide-react';
import type { Character, Scene } from '../../shared/types';

interface CleanupSuggestion {
  type: 'merge' | 'delete' | 'rename';
  category: 'character' | 'scene';
  items: string[];
  targetName?: string;
  reason: string;
}

interface CleanupReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  characters: Character[];
  scenes: Scene[];
  onApplyCleanup: (suggestions: CleanupSuggestion[]) => Promise<void>;
}

export function CleanupReviewModal({
  isOpen,
  onClose,
  characters,
  scenes,
  onApplyCleanup,
}: CleanupReviewModalProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [suggestions, setSuggestions] = useState<CleanupSuggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      analyzeForCleanup();
    }
  }, [isOpen, characters, scenes]);

  const analyzeForCleanup = async () => {
    setIsAnalyzing(true);
    setError(null);
    setSuggestions([]);

    try {
      // Analyze characters for duplicates/similar names
      const charSuggestions = analyzeCharacters(characters);
      
      // Analyze scenes for issues
      const sceneSuggestions = analyzeScenes(scenes);
      
      const allSuggestions = [...charSuggestions, ...sceneSuggestions];
      setSuggestions(allSuggestions);
      
      // Select all by default
      setSelectedSuggestions(new Set(allSuggestions.map((_, i) => i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Analyze characters for potential duplicates or issues
  const analyzeCharacters = (chars: Character[]): CleanupSuggestion[] => {
    const suggestions: CleanupSuggestion[] = [];
    const processed = new Set<string>();

    // Group similar names
    const nameGroups = new Map<string, Character[]>();

    for (const char of chars) {
      // Normalize name for comparison
      const normalized = char.name
        .toUpperCase()
        .replace(/['']/g, "'")
        .replace(/\s+/g, ' ')
        .trim();

      // Check for variations (O'KEEFE vs O'KEEFFE, etc.)
      const baseKey = normalized
        .replace(/[^A-Z\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!nameGroups.has(baseKey)) {
        nameGroups.set(baseKey, []);
      }
      nameGroups.get(baseKey)!.push(char);
    }

    // Find groups with multiple characters (potential duplicates)
    for (const [, group] of nameGroups) {
      if (group.length > 1) {
        const names = group.map(c => c.name);
        suggestions.push({
          type: 'merge',
          category: 'character',
          items: names,
          targetName: names[0], // Default to first name
          reason: `Found ${group.length} similar character names that may be duplicates`,
        });
        names.forEach(n => processed.add(n));
      }
    }

    // Check for very short or likely-invalid character names
    for (const char of chars) {
      if (processed.has(char.name)) continue;

      const trimmed = char.name.trim();
      
      // Single letter or very short names
      if (trimmed.length <= 2) {
        suggestions.push({
          type: 'delete',
          category: 'character',
          items: [char.name],
          reason: 'Character name is too short and may be incorrectly detected',
        });
        continue;
      }

      // Names that look like action lines (contain verbs or common action words)
      const actionPatterns = /\b(WALKS|RUNS|LOOKS|STANDS|SITS|ENTERS|EXITS|TURNS|MOVES)\b/i;
      if (actionPatterns.test(trimmed)) {
        suggestions.push({
          type: 'delete',
          category: 'character',
          items: [char.name],
          reason: 'Name appears to be an action line, not a character',
        });
      }
    }

    return suggestions;
  };

  // Analyze scenes for potential issues
  const analyzeScenes = (sceneList: Scene[]): CleanupSuggestion[] => {
    const suggestions: CleanupSuggestion[] = [];

    // Check for duplicate scene headings
    const headingCounts = new Map<string, Scene[]>();
    for (const scene of sceneList) {
      const heading = scene.heading.toUpperCase().trim();
      if (!headingCounts.has(heading)) {
        headingCounts.set(heading, []);
      }
      headingCounts.get(heading)!.push(scene);
    }

    for (const [, sceneGroup] of headingCounts) {
      if (sceneGroup.length > 1) {
        suggestions.push({
          type: 'merge',
          category: 'scene',
          items: sceneGroup.map(s => `Scene ${s.number}: ${s.heading}`),
          reason: `Found ${sceneGroup.length} scenes with the same heading`,
        });
      }
    }

    // Check for empty or very short scenes
    for (const scene of sceneList) {
      if (!scene.content || scene.content.trim().length < 10) {
        suggestions.push({
          type: 'delete',
          category: 'scene',
          items: [`Scene ${scene.number}: ${scene.heading}`],
          reason: 'Scene has no content or is very short',
        });
      }
    }

    return suggestions;
  };

  const toggleSuggestion = (index: number) => {
    const newSelected = new Set(selectedSuggestions);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedSuggestions(newSelected);
  };

  const handleApply = async () => {
    const toApply = suggestions.filter((_, i) => selectedSuggestions.has(i));
    if (toApply.length === 0) return;

    setIsApplying(true);
    try {
      await onApplyCleanup(toApply);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply cleanup');
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Clean Up Characters & Scenes
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-700 rounded"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Analyzing your screenplay for potential issues...</p>
            </div>
          ) : error ? (
            <div className="text-red-400 p-4 bg-red-900/20 rounded">
              {error}
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-12 text-zinc-400">
              <Check className="w-12 h-12 mx-auto mb-4 text-green-400" />
              <p className="text-lg font-medium text-white">All Clear!</p>
              <p>No duplicate characters or scene issues were found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-zinc-400 mb-4">
                Found {suggestions.length} potential issue(s). Select the ones you want to fix:
              </p>

              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                    selectedSuggestions.has(index)
                      ? 'border-blue-500 bg-blue-900/20'
                      : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                  }`}
                  onClick={() => toggleSuggestion(index)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center ${
                      selectedSuggestions.has(index)
                        ? 'bg-blue-500 border-blue-500'
                        : 'border-zinc-600'
                    }`}>
                      {selectedSuggestions.has(index) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {suggestion.type === 'merge' ? (
                          <Merge className="w-4 h-4 text-purple-400" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-red-400" />
                        )}
                        <span className="text-sm font-medium text-white">
                          {suggestion.type === 'merge' ? 'Merge' : 'Delete'}{' '}
                          <span className="text-zinc-400">
                            ({suggestion.category})
                          </span>
                        </span>
                      </div>

                      <div className="text-sm text-zinc-300 mb-2">
                        {suggestion.items.map((item, i) => (
                          <span key={i}>
                            {i > 0 && (
                              <span className="text-zinc-500 mx-1">→</span>
                            )}
                            <code className="bg-zinc-700 px-1 rounded">
                              {item}
                            </code>
                          </span>
                        ))}
                        {suggestion.targetName && suggestion.type === 'merge' && (
                          <>
                            <span className="text-zinc-500 mx-1">→</span>
                            <code className="bg-green-900/50 text-green-300 px-1 rounded">
                              {suggestion.targetName}
                            </code>
                          </>
                        )}
                      </div>

                      <p className="text-xs text-zinc-500">{suggestion.reason}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-zinc-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          
          <div className="flex gap-2">
            {suggestions.length > 0 && (
              <>
                <button
                  onClick={() => setSelectedSuggestions(new Set())}
                  className="px-3 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setSelectedSuggestions(new Set(suggestions.map((_, i) => i)))}
                  className="px-3 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  Select All
                </button>
              </>
            )}
            <button
              onClick={handleApply}
              disabled={isApplying || selectedSuggestions.size === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Apply Selected ({selectedSuggestions.size})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { CleanupSuggestion };

