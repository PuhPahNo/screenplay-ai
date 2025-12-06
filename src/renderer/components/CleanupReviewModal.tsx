import { useState, useEffect } from 'react';
import { X, AlertTriangle, Check, Merge, Trash2, Loader2, Sparkles, Plus, RefreshCw } from 'lucide-react';
import type { Character, Scene } from '../../shared/types';

interface CleanupSuggestion {
  type: 'merge' | 'delete' | 'rename' | 'add';
  category: 'character' | 'scene';
  items: string[];
  targetName?: string;
  reason: string;
}

interface LLMAnalysisResult {
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
}

interface CleanupReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  characters: Character[];
  scenes: Scene[];
  screenplayContent: string;
  onApplyCleanup: (suggestions: CleanupSuggestion[]) => Promise<void>;
  onSyncFromLLM?: (analysis: LLMAnalysisResult) => Promise<void>;
}

export function CleanupReviewModal({
  isOpen,
  onClose,
  characters,
  scenes,
  screenplayContent,
  onApplyCleanup,
  onSyncFromLLM,
}: CleanupReviewModalProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [suggestions, setSuggestions] = useState<CleanupSuggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<string>('');
  const [llmAnalysis, setLlmAnalysis] = useState<LLMAnalysisResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      analyzeWithLLM();
    }
  }, [isOpen]);

  // LLM-powered analysis for accurate character/scene detection
  const analyzeWithLLM = async () => {
    setIsAnalyzing(true);
    setError(null);
    setSuggestions([]);
    setLlmAnalysis(null);
    setAnalysisProgress('Initializing AI analysis...');

    try {
      console.log('[Cleanup] Starting LLM-powered analysis...');
      console.log('[Cleanup] Characters in DB:', characters.length);
      console.log('[Cleanup] Scenes in DB:', scenes.length);
      console.log('[Cleanup] Screenplay length:', screenplayContent?.length || 0);

      if (!screenplayContent || screenplayContent.trim().length === 0) {
        setError('No screenplay content to analyze');
        setIsAnalyzing(false);
        return;
      }

      setAnalysisProgress('Sending screenplay to AI for intelligent analysis...');
      
      // Call the LLM-powered analysis
      const analysis: LLMAnalysisResult = await window.api.ai.analyzeScreenplay(screenplayContent);
      setLlmAnalysis(analysis);
      
      console.log('[Cleanup] LLM found:', analysis.characters.length, 'characters,', analysis.scenes.length, 'scenes');
      console.log('[Cleanup] LLM duplicates:', analysis.duplicates);
      
      setAnalysisProgress('Comparing AI results with database...');
      
      // Now compare LLM results with what's in the database
      const allSuggestions: CleanupSuggestion[] = [];
      
      // 1. Find characters in DB that LLM didn't find (orphaned)
      const llmCharNames = new Set(analysis.characters.map(c => c.normalizedName.toUpperCase()));
      const llmAliases = new Set<string>();
      analysis.characters.forEach(c => c.aliases.forEach(a => llmAliases.add(a.toUpperCase())));
      
      for (const dbChar of characters) {
        const nameUpper = dbChar.name.toUpperCase().trim();
        if (!llmCharNames.has(nameUpper) && !llmAliases.has(nameUpper)) {
          allSuggestions.push({
            type: 'delete',
            category: 'character',
            items: [dbChar.name],
            reason: 'AI did not detect this as a valid character in the screenplay',
          });
        }
      }
      
      // 2. Add LLM-detected duplicates
      for (const dup of analysis.duplicates) {
        allSuggestions.push({
          type: 'merge',
          category: 'character',
          items: dup.names,
          targetName: dup.suggestedName,
          reason: dup.reason,
        });
      }
      
      // 3. Find missing characters (LLM found but not in DB)
      const dbCharNames = new Set(characters.map(c => c.name.toUpperCase().trim()));
      for (const llmChar of analysis.characters) {
        if (!dbCharNames.has(llmChar.normalizedName.toUpperCase())) {
          allSuggestions.push({
            type: 'add',
            category: 'character',
            items: [llmChar.name],
            reason: `AI detected character with ${llmChar.dialogueCount} dialogue line(s)`,
          });
        }
      }
      
      // 4. Find scenes in DB that LLM didn't find
      const llmSceneHeadings = new Set(analysis.scenes.map(s => s.heading.toUpperCase().trim()));
      for (const dbScene of scenes) {
        const headingUpper = dbScene.heading.toUpperCase().trim();
        if (!llmSceneHeadings.has(headingUpper)) {
          allSuggestions.push({
            type: 'delete',
            category: 'scene',
            items: [`Scene ${dbScene.number}: ${dbScene.heading}`],
            reason: 'AI did not find this scene heading in the screenplay',
          });
        }
      }
      
      // 5. Find missing scenes (LLM found but not in DB)
      const dbSceneHeadings = new Set(scenes.map(s => s.heading.toUpperCase().trim()));
      for (const llmScene of analysis.scenes) {
        if (!dbSceneHeadings.has(llmScene.heading.toUpperCase().trim())) {
          allSuggestions.push({
            type: 'add',
            category: 'scene',
            items: [`${llmScene.heading}`],
            reason: `AI detected scene: ${llmScene.location} - ${llmScene.timeOfDay}`,
          });
        }
      }

      console.log('[Cleanup] Total suggestions:', allSuggestions.length);
      setSuggestions(allSuggestions);
      setSelectedSuggestions(new Set(allSuggestions.map((_, i) => i)));
      setAnalysisProgress('');
      
    } catch (err) {
      console.error('[Cleanup] LLM Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze with AI. Please check your API key and try again.');
      setAnalysisProgress('');
    } finally {
      setIsAnalyzing(false);
    }
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

  const handleSyncAll = async () => {
    if (!llmAnalysis || !onSyncFromLLM) return;
    
    setIsSyncing(true);
    try {
      await onSyncFromLLM(llmAnalysis);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync from AI');
    } finally {
      setIsSyncing(false);
    }
  };

  const getSuggestionIcon = (suggestion: CleanupSuggestion) => {
    switch (suggestion.type) {
      case 'add':
        return <Plus className="w-4 h-4 text-green-400" />;
      case 'merge':
        return <Merge className="w-4 h-4 text-purple-400" />;
      case 'delete':
        return <Trash2 className="w-4 h-4 text-red-400" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    }
  };

  const getSuggestionLabel = (suggestion: CleanupSuggestion) => {
    switch (suggestion.type) {
      case 'add':
        return 'Add';
      case 'merge':
        return 'Merge';
      case 'delete':
        return 'Remove';
      default:
        return suggestion.type;
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
            <Sparkles className="w-5 h-5 text-blue-400" />
            AI-Powered Screenplay Analysis
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
              <Sparkles className="w-10 h-10 animate-pulse mb-4 text-blue-400" />
              <p className="text-white font-medium mb-2">Analyzing with AI...</p>
              <p className="text-sm">{analysisProgress}</p>
              <p className="text-xs mt-4 text-zinc-500">This may take a moment for longer screenplays</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-400 p-4 bg-red-900/20 rounded mb-4">
                {error}
              </div>
              <button
                onClick={analyzeWithLLM}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-sm flex items-center gap-2 mx-auto"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Analysis
              </button>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-12 text-zinc-400">
              <Check className="w-12 h-12 mx-auto mb-4 text-green-400" />
              <p className="text-lg font-medium text-white">Perfect Match!</p>
              <p>Your database matches the AI analysis exactly.</p>
              {llmAnalysis && (
                <p className="text-sm mt-2 text-zinc-500">
                  {llmAnalysis.characters.length} characters, {llmAnalysis.scenes.length} scenes detected
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Summary */}
              {llmAnalysis && (
                <div className="p-3 bg-blue-900/20 border border-blue-800 rounded-lg mb-4">
                  <p className="text-sm text-blue-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    AI detected <strong>{llmAnalysis.characters.length}</strong> characters and <strong>{llmAnalysis.scenes.length}</strong> scenes
                  </p>
                </div>
              )}
              
              <p className="text-sm text-zinc-400 mb-4">
                Found {suggestions.length} difference(s) between AI analysis and your database:
              </p>

              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                    selectedSuggestions.has(index)
                      ? suggestion.type === 'add' 
                        ? 'border-green-500 bg-green-900/20'
                        : suggestion.type === 'merge'
                        ? 'border-purple-500 bg-purple-900/20'
                        : 'border-red-500 bg-red-900/20'
                      : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                  }`}
                  onClick={() => toggleSuggestion(index)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center ${
                      selectedSuggestions.has(index)
                        ? suggestion.type === 'add'
                          ? 'bg-green-500 border-green-500'
                          : suggestion.type === 'merge'
                          ? 'bg-purple-500 border-purple-500'
                          : 'bg-red-500 border-red-500'
                        : 'border-zinc-600'
                    }`}>
                      {selectedSuggestions.has(index) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getSuggestionIcon(suggestion)}
                        <span className="text-sm font-medium text-white">
                          {getSuggestionLabel(suggestion)}{' '}
                          <span className="text-zinc-400">
                            ({suggestion.category})
                          </span>
                        </span>
                      </div>

                      <div className="text-sm text-zinc-300 mb-2">
                        {suggestion.items.map((item, i) => (
                          <span key={i}>
                            {i > 0 && (
                              <span className="text-zinc-500 mx-1">+</span>
                            )}
                            <code className={`px-1 rounded ${
                              suggestion.type === 'add' 
                                ? 'bg-green-900/50 text-green-300'
                                : 'bg-zinc-700'
                            }`}>
                              {item}
                            </code>
                          </span>
                        ))}
                        {suggestion.targetName && suggestion.type === 'merge' && (
                          <>
                            <span className="text-zinc-500 mx-1">→</span>
                            <code className="bg-purple-900/50 text-purple-300 px-1 rounded">
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
            {!isAnalyzing && !error && (
              <button
                onClick={analyzeWithLLM}
                className="px-3 py-2 text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-4 h-4" />
                Re-analyze
              </button>
            )}
            
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
            
            {llmAnalysis && onSyncFromLLM && (
              <button
                onClick={handleSyncAll}
                disabled={isSyncing}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Sync All from AI
                  </>
                )}
              </button>
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

export type { CleanupSuggestion, LLMAnalysisResult };
