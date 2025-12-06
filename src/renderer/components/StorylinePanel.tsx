import { useAppStore } from '../store/app-store';
import { BarChart3 } from 'lucide-react';

export default function StorylinePanel() {
  const { storyline, analyzeStoryline } = useAppStore();

  const handleAnalyze = async () => {
    try {
      await analyzeStoryline();
    } catch (error: any) {
      const message = error?.message || String(error);
      console.error('[StorylinePanel] Analysis error:', error);
      
      if (message.includes('API key') || message.includes('Connection error') || message.includes('not a legal HTTP header')) {
        alert('AI features require a valid OpenAI API key.\n\nPlease add your API key in Settings, or ensure your .env file contains OPENAI_API_KEY.');
      } else {
        alert('Failed to analyze storyline: ' + message);
      }
    }
  };

  if (!storyline) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 rounded-2xl mb-6 inline-block">
            <BarChart3 className="w-16 h-16 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Storyline Analysis
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Use AI to analyze your screenplay's structure, identify plot points, and get insights about your story.
          </p>
          <button
            onClick={handleAnalyze}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2 mx-auto"
            title="Analyze screenplay structure using AI. Requires OpenAI API key in Settings or .env file."
          >
            <BarChart3 className="w-4 h-4" />
            <span>Analyze with AI</span>
          </button>
        </div>
      </div>
    );
  }

  const acts = [1, 2, 3].map((actNum) => ({
    number: actNum,
    plotPoints: storyline.plotPoints?.filter((p) => {
      // Simple heuristic: distribute plot points across acts
      const totalPoints = storyline.plotPoints.length;
      const pointsPerAct = Math.ceil(totalPoints / 3);
      const startIdx = (actNum - 1) * pointsPerAct;
      const endIdx = actNum * pointsPerAct;
      const idx = storyline.plotPoints.indexOf(p);
      return idx >= startIdx && idx < endIdx;
    }) || [],
  }));

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-dark-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Storyline</h3>
          <button
            onClick={handleAnalyze}
            className="px-3 py-1 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            title="Re-analyze screenplay structure using AI. Requires OpenAI API key."
          >
            Re-analyze
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Narrative Structure */}
        {storyline.narrativeStructure && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Structure</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {storyline.narrativeStructure}
            </p>
          </div>
        )}

        {/* Themes */}
        {storyline.themes && storyline.themes.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Themes</h4>
            <div className="flex flex-wrap gap-2">
              {storyline.themes.map((theme, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 text-xs bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded-full"
                >
                  {theme}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Three-Act Structure */}
        <div>
          <h4 className="text-sm font-semibold mb-3">Three-Act Structure</h4>
          <div className="space-y-4">
            {acts.map((act) => (
              <div key={act.number} className="border border-gray-200 dark:border-dark-border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-semibold">
                    {act.number}
                  </div>
                  <h5 className="text-sm font-semibold">Act {act.number}</h5>
                </div>
                
                {act.plotPoints.length > 0 ? (
                  <div className="space-y-2 ml-8">
                    {act.plotPoints.map((point) => (
                      <div key={point.id} className="text-xs">
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {point.name}
                        </p>
                        {point.description && (
                          <p className="text-gray-600 dark:text-gray-400 mt-1">
                            {point.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 ml-8">
                    No plot points identified yet
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Plot Points Timeline */}
        {storyline.plotPoints && storyline.plotPoints.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3">Plot Points</h4>
            <div className="space-y-2">
              {storyline.plotPoints.map((point, idx) => (
                <div
                  key={point.id}
                  className="flex gap-3 items-start"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 dark:bg-dark-border flex items-center justify-center text-xs font-semibold">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{point.name}</p>
                    {point.description && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {point.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

