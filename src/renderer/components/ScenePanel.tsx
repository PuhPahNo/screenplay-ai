import { useState } from 'react';
import { useAppStore } from '../store/app-store';
import { Film, Plus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import SceneCard from './SceneCard';
import type { Scene } from '../../shared/types';

function SortableSceneCard({ scene, characters, onEdit, onDelete, onClick }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scene.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <SceneCard
        scene={scene}
        characters={characters}
        onEdit={onEdit}
        onDelete={onDelete}
        onClick={onClick}
        isDragging={isDragging}
        dragHandleProps={listeners}
      />
    </div>
  );
}

interface ScenePanelProps {
  onSceneClick?: (sceneStartLine: number) => void;
}

export default function ScenePanel({ onSceneClick }: ScenePanelProps) {
  const { scenes, characters, setScenes, screenplayContent, setScreenplayContent, saveScreenplay } = useAppStore();
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newSceneHeading, setNewSceneHeading] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = scenes.findIndex((s) => s.id === active.id);
      const newIndex = scenes.findIndex((s) => s.id === over.id);

      const newScenes = arrayMove(scenes, oldIndex, newIndex).map((scene, index) => ({
        ...scene,
        order: index,
        number: index + 1,
      }));

      setScenes(newScenes);

      // Save scene order to database
      newScenes.forEach((scene) => {
        window.api.db.saveScene(scene).catch(console.error);
      });
    }
  };

  const handleSceneClick = (sceneId: string) => {
    setSelectedSceneId(sceneId);
    const scene = scenes.find((s) => s.id === sceneId);
    if (scene && onSceneClick) {
      onSceneClick(scene.startLine);
    }
  };

  const handleEdit = (scene: Scene) => {
    const newSummary = prompt('Edit scene summary:', scene.summary);
    if (newSummary !== null) {
      const updatedScene = { ...scene, summary: newSummary };
      window.api.db.saveScene(updatedScene).then(() => {
        const newScenes = scenes.map((s) => (s.id === scene.id ? updatedScene : s));
        setScenes(newScenes);
      }).catch((error) => {
        alert('Failed to update scene: ' + error);
      });
    }
  };

  const handleDelete = async (scene: Scene) => {
    if (confirm(`Delete scene "${scene.heading}"?\n\nThis will remove it from the database but not from your screenplay.`)) {
      try {
        // Delete from database
        await window.api.db.deleteScene(scene.id);
        
        // Update local state
        const newScenes = scenes.filter((s) => s.id !== scene.id);
        setScenes(newScenes);
      } catch (error) {
        alert('Failed to delete scene: ' + error);
      }
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const heading = newSceneHeading.trim();
    
    if (!heading) {
      setIsCreating(false);
      return;
    }

    console.log('[ScenePanel] Creating scene with heading:', heading);

    try {
      // Parse location and time of day from heading
      const parseLocation = (h: string) => {
        const match = h.match(/^(?:INT|EXT|INT\.\/EXT|I\/E)[\.\s]+(.+?)\s*-\s*/i);
        return match ? match[1].trim() : '';
      };

      const parseTimeOfDay = (h: string) => {
        const match = h.match(/-\s*(.+)$/);
        return match ? match[1].trim() : '';
      };

      const newScene: Scene = {
        id: uuidv4(),
        number: scenes.length + 1,
        heading: heading,
        location: parseLocation(heading),
        timeOfDay: parseTimeOfDay(heading),
        summary: '',
        characters: [],
        startLine: -1,
        endLine: -1,
        content: heading,
        order: scenes.length,
      };

      // Save to database
      await window.api.db.saveScene(newScene);

      // Add to screenplay content
      const newContent = `${screenplayContent}\n\n${heading}\n\n`;
      setScreenplayContent(newContent);
      await saveScreenplay();

      // Reload scenes to update UI
      const updatedScenes = await window.api.db.getScenes();
      setScenes(updatedScenes);
      
      // Reset state
      setNewSceneHeading('');
      setIsCreating(false);
    } catch (error) {
      alert('Failed to create scene: ' + error);
    }
  };

  const handleCreateCancel = () => {
    setIsCreating(false);
    setNewSceneHeading('');
  };

  if (scenes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 p-6 rounded-2xl mb-6 inline-block">
            <Film className="w-16 h-16 text-primary-600 dark:text-primary-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Scenes Yet
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Start writing your screenplay with scene headings and they'll appear here automatically.
          </p>
          <div className="bg-gray-100 dark:bg-dark-bg rounded-xl p-4 space-y-2">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Scene Heading Examples:
            </p>
            <code className="block text-xs font-mono text-primary-600 dark:text-primary-400 bg-white dark:bg-dark-surface px-3 py-2 rounded-lg">
              INT. COFFEE SHOP - DAY
            </code>
            <code className="block text-xs font-mono text-primary-600 dark:text-primary-400 bg-white dark:bg-dark-surface px-3 py-2 rounded-lg">
              EXT. CITY STREET - NIGHT
            </code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-dark-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            Scenes ({scenes.length})
          </h3>
          <button
            onClick={() => setIsCreating(true)}
            className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-1.5 shadow-md"
            title="Add new scene"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Drag to reorder scenes
        </p>
      </div>

      {/* New Scene Input */}
      {isCreating && (
        <div className="p-4 bg-gray-50 dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border">
          <form onSubmit={handleCreateSubmit}>
            <input
              autoFocus
              type="text"
              value={newSceneHeading}
              onChange={(e) => setNewSceneHeading(e.target.value)}
              placeholder="INT. LOCATION - DAY"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-sm mb-2"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCreateCancel}
                className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-border rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Scenes List with Drag and Drop */}
      <div className="flex-1 overflow-y-auto p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={scenes.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {scenes.map((scene) => (
                <SortableSceneCard
                  key={scene.id}
                  scene={scene}
                  characters={characters}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onClick={() => handleSceneClick(scene.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
