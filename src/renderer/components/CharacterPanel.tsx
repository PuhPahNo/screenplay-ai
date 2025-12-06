import { useState } from 'react';
import { useAppStore } from '../store/app-store';
import { Plus, Grid, List, Search, User } from 'lucide-react';
import CharacterEditor from './CharacterEditor';
import type { Character } from '../../shared/types';

type ViewMode = 'grid' | 'list';

export default function CharacterPanel() {
  const { characters, saveCharacter } = useAppStore();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const handleCreateNew = () => {
    setSelectedCharacter(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (character: Character) => {
    setSelectedCharacter(character);
    setIsEditorOpen(true);
  };

  const handleSave = async (character: Character) => {
    try {
      await saveCharacter(character);
      setIsEditorOpen(false);
      setSelectedCharacter(null);
    } catch (error) {
      alert('Failed to save character: ' + error);
    }
  };


  const filteredCharacters = characters.filter((char) =>
    char.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    char.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    char.occupation?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-dark-border space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Characters</h3>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-300 dark:border-dark-border">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 transition-colors ${
                  viewMode === 'list'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-bg'
                }`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-bg'
                }`}
                title="Grid view"
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={handleCreateNew}
              className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-4 h-4" />
              New
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search characters..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {filteredCharacters.length === 0 ? (
          <div className="h-full flex items-center justify-center p-6">
            <div className="text-center max-w-sm">
              {characters.length === 0 ? (
                <>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-6 rounded-2xl mb-6 inline-block">
                    <Plus className="w-16 h-16 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    No Characters Yet
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Characters will appear automatically as you write dialogue, or you can add them manually.
                  </p>
                  <button
                    onClick={handleCreateNew}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-md hover:shadow-lg flex items-center gap-2 mx-auto"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Character</span>
                  </button>
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No characters match "{searchQuery}"
                </p>
              )}
            </div>
          </div>
        ) : viewMode === 'list' ? (
          <div className="divide-y divide-gray-200 dark:divide-dark-border">
            {filteredCharacters.map((character) => (
              <div
                key={character.id}
                onClick={() => handleEdit(character)}
                className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-bg transition-all duration-200"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 flex items-center justify-center">
                    {character.imageUrl ? (
                      <img
                        src={character.imageUrl}
                        alt={character.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                      {character.name}
                    </h4>
                    {character.occupation && (
                      <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">
                        {character.occupation}
                        {character.age && ` • ${character.age}`}
                      </p>
                    )}
                    {character.description && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                        {character.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                      {character.appearances.length} scene{character.appearances.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-4">
            {filteredCharacters.map((character) => (
              <div
                key={character.id}
                onClick={() => handleEdit(character)}
                className="p-4 border border-gray-200 dark:border-dark-border rounded-lg cursor-pointer hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600 transition-all duration-200 bg-white dark:bg-dark-surface"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 flex items-center justify-center mb-3">
                    {character.imageUrl ? (
                      <img
                        src={character.imageUrl}
                        alt={character.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                    )}
                  </div>
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate w-full">
                    {character.name}
                  </h4>
                  {character.occupation && (
                    <p className="text-xs text-primary-600 dark:text-primary-400 mt-1 truncate w-full">
                      {character.occupation}
                    </p>
                  )}
                  {character.age && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Age {character.age}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    {character.appearances.length} scene{character.appearances.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Character Editor Modal */}
      {isEditorOpen && (
        <CharacterEditor
          character={selectedCharacter}
          allCharacters={characters}
          onSave={handleSave}
          onClose={() => {
            setIsEditorOpen(false);
            setSelectedCharacter(null);
          }}
        />
      )}
    </div>
  );
}
