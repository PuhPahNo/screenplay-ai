import { useState } from 'react';
import { useAppStore } from '../store/app-store';
import { BarChart3, X, Loader2 } from 'lucide-react';

export default function AnalyzePromptModal() {
  const { showAnalyzePrompt, setShowAnalyzePrompt, screenplayContent, loadCharacters, loadScenes } = useAppStore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState('');
  
  if (!showAnalyzePrompt) return null;
  
  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setProgress('Starting AI analysis...');
    
    try {
      // Use the centralized LLM analysis that includes character enrichment
      setProgress('Analyzing screenplay with AI...');
      const analysis = await window.api.ai.analyzeScreenplay(screenplayContent);
      
      // Reload data from database (analysis already saved items with enrichment)
      setProgress('Loading updated data...');
      await loadCharacters();
      await loadScenes();
      
      setShowAnalyzePrompt(false);
      alert(`Analysis complete! Found ${analysis.scenes.length} scenes and ${analysis.characters.length} characters with enriched profiles.`);
    } catch (error) {
      console.error('[AnalyzePromptModal] Analysis failed:', error);
      alert('Failed to analyze: ' + error);
    } finally {
      setIsAnalyzing(false);
      setProgress('');
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-surface rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold">Analyze Screenplay?</h2>
          </div>
          <button
            onClick={() => setShowAnalyzePrompt(false)}
            className="text-gray-400 hover:text-gray-600"
            disabled={isAnalyzing}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          This project contains screenplay content but no characters or scenes have been extracted yet. 
          Would you like to analyze it now to automatically extract characters and scenes?
        </p>
        
        {isAnalyzing && progress && (
          <div className="flex items-center gap-2 mb-4 text-sm text-purple-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{progress}</span>
          </div>
        )}
        
        <div className="flex gap-3">
          <button
            onClick={() => setShowAnalyzePrompt(false)}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors disabled:opacity-50"
            disabled={isAnalyzing}
          >
            Skip
          </button>
          <button
            onClick={handleAnalyze}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              'Analyze Now'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
