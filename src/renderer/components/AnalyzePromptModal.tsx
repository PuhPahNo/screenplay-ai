import { useAppStore } from '../store/app-store';
import { BarChart3, X } from 'lucide-react';

export default function AnalyzePromptModal() {
  const { showAnalyzePrompt, setShowAnalyzePrompt, screenplayContent } = useAppStore();
  
  if (!showAnalyzePrompt) return null;
  
  const handleAnalyze = async () => {
    try {
      const parsed = await window.api.parse.fountain(screenplayContent);
      
      for (const scene of parsed.scenes) {
        await window.api.db.saveScene(scene);
      }
      
      for (const scene of parsed.scenes) {
        for (const charName of scene.characters) {
          const existing = useAppStore.getState().characters.find(c =>
            c.id === charName || c.name.toUpperCase() === charName.toUpperCase()
          );
          
          if (!existing) {
            await window.api.db.saveCharacter({
              id: charName,
              name: charName,
              description: '',
              arc: '',
              relationships: {},
              appearances: [scene.id],
            });
          }
        }
      }
      
      await useAppStore.getState().loadCharacters();
      await useAppStore.getState().loadScenes();
      
      setShowAnalyzePrompt(false);
      alert(`Analysis complete! Found ${parsed.scenes.length} scenes.`);
    } catch (error) {
      alert('Failed to analyze: ' + error);
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
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          This project contains screenplay content but no characters or scenes have been extracted yet. 
          Would you like to analyze it now to automatically extract characters and scenes?
        </p>
        
        <div className="flex gap-3">
          <button
            onClick={() => setShowAnalyzePrompt(false)}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleAnalyze}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Analyze Now
          </button>
        </div>
      </div>
    </div>
  );
}

