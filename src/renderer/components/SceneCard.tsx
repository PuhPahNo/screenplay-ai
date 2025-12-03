import { GripVertical, Trash2 } from 'lucide-react';
import type { Scene, Character } from '../../shared/types';

interface SceneCardProps {
  scene: Scene;
  characters: Character[];
  onDelete?: (scene: Scene) => void;
  onClick?: () => void;
  isDragging?: boolean;
  dragHandleProps?: any;
}

export default function SceneCard({
  scene,
  characters,
  onDelete,
  onClick,
  isDragging = false,
  dragHandleProps,
}: SceneCardProps) {
  const sceneCharacters = characters.filter((char) =>
    scene.characters.includes(char.id)
  );

  const getTimeOfDayColor = (timeOfDay: string) => {
    const tod = timeOfDay.toLowerCase();
    if (tod.includes('day')) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    if (tod.includes('night')) return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
    if (tod.includes('dawn') || tod.includes('dusk')) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
  };

  return (
    <div
      onClick={onClick}
      className={`group relative bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg p-3 transition-all duration-200 hover:shadow-md hover:border-primary-400 dark:hover:border-primary-600 cursor-pointer ${
        isDragging ? 'opacity-50 shadow-xl scale-105' : ''
      }`}
    >
      {/* Drag Handle */}
      <div 
        {...dragHandleProps}
        className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4 text-gray-400" />
      </div>

      <div className="flex items-center gap-3 pl-3">
        {/* Scene Number - Large and Prominent */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-primary-600 dark:bg-primary-700 flex items-center justify-center shadow-sm">
            <span className="text-lg font-bold text-white">
              {scene.number}
            </span>
          </div>
        </div>

        {/* Scene Info - Compact */}
        <div className="flex-1 min-w-0">
          {/* Scene Heading - Single Line */}
          <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate mb-1">
            {scene.heading}
          </h4>

          {/* Metadata - Inline and Minimal */}
          <div className="flex items-center gap-2 text-xs">
            {scene.timeOfDay && (
              <span className={`px-2 py-0.5 rounded-full font-medium ${getTimeOfDayColor(scene.timeOfDay)}`}>
                {scene.timeOfDay}
              </span>
            )}
            
            {sceneCharacters.length > 0 && (
              <span className="text-gray-500 dark:text-gray-400">
                {sceneCharacters.length} {sceneCharacters.length === 1 ? 'character' : 'characters'}
              </span>
            )}
          </div>
        </div>

        {/* Delete Button - Right Side, Visible on Hover */}
        {onDelete && (
          <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(scene);
              }}
              className="p-1.5 bg-white dark:bg-dark-bg border border-red-200 dark:border-red-900/50 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Delete scene"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
