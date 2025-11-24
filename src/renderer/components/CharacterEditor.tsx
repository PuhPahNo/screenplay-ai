import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { X, Save, Plus, Trash2, User } from 'lucide-react';
import type { Character } from '../../shared/types';

interface CharacterEditorProps {
  character: Character | null;
  allCharacters: Character[];
  onSave: (character: Character) => void;
  onClose: () => void;
}

type TabType = 'overview' | 'details' | 'relationships' | 'custom';

function CharacterEditor({
  character,
  allCharacters,
  onSave,
  onClose,
}: CharacterEditorProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const initialCharacterRef = useRef(character);
  
  // Initialize edited character only once, not on every render
  const [editedCharacter, setEditedCharacter] = useState<Character>(() => 
    character || {
      id: Date.now().toString(),
      name: '',
      description: '',
      arc: '',
      relationships: {},
      appearances: [],
    }
  );

  const [newCustomKey, setNewCustomKey] = useState('');
  const [newCustomValue, setNewCustomValue] = useState('');

  const handleSave = useCallback(() => {
    if (!editedCharacter.name.trim()) {
      alert('Please enter a character name');
      return;
    }
    onSave(editedCharacter);
  }, [editedCharacter, onSave]);

  const updateField = useCallback((field: keyof Character, value: any) => {
    setEditedCharacter(prev => ({ ...prev, [field]: value }));
  }, []);

  const addCustomAttribute = useCallback(() => {
    if (!newCustomKey.trim()) return;

    setEditedCharacter(prev => ({
      ...prev,
      customAttributes: {
        ...prev.customAttributes,
        [newCustomKey]: newCustomValue,
      }
    }));

    setNewCustomKey('');
    setNewCustomValue('');
  }, [newCustomKey, newCustomValue]);

  const removeCustomAttribute = useCallback((key: string) => {
    setEditedCharacter(prev => {
      const updated = { ...prev.customAttributes };
      delete updated[key];
      return { ...prev, customAttributes: updated };
    });
  }, []);

  const updateRelationship = useCallback((characterId: string, relationship: string) => {
    setEditedCharacter(prev => ({
      ...prev,
      relationships: {
        ...prev.relationships,
        [characterId]: relationship,
      }
    }));
  }, []);

  const tabs: Array<{ id: TabType; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'details', label: 'Details' },
    { id: 'relationships', label: 'Relationships' },
    { id: 'custom', label: 'Custom' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-surface rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <User className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {character ? 'Edit Character' : 'New Character'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {editedCharacter.name || 'Unnamed Character'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-bg rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-dark-border px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={editedCharacter.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Character Name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Age
                  </label>
                  <input
                    type="text"
                    value={editedCharacter.age || ''}
                    onChange={(e) => updateField('age', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., 35 or Late 30s"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Occupation
                  </label>
                  <input
                    type="text"
                    value={editedCharacter.occupation || ''}
                    onChange={(e) => updateField('occupation', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., Detective"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quick Description
                </label>
                <textarea
                  value={editedCharacter.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="Brief character description..."
                />
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Physical Appearance
                </label>
                <textarea
                  value={editedCharacter.physicalAppearance || ''}
                  onChange={(e) => updateField('physicalAppearance', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="Height, build, hair, eyes, distinguishing features..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Personality
                </label>
                <textarea
                  value={editedCharacter.personality || ''}
                  onChange={(e) => updateField('personality', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="Personality traits, quirks, mannerisms..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Goals
                </label>
                <textarea
                  value={editedCharacter.goals || ''}
                  onChange={(e) => updateField('goals', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="What does this character want?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Fears
                </label>
                <textarea
                  value={editedCharacter.fears || ''}
                  onChange={(e) => updateField('fears', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="What does this character fear?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Backstory
                </label>
                <textarea
                  value={editedCharacter.backstory || ''}
                  onChange={(e) => updateField('backstory', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="Character's history and background..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Character Arc
                </label>
                <textarea
                  value={editedCharacter.arc}
                  onChange={(e) => updateField('arc', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="How does this character change throughout the story?"
                />
              </div>
            </div>
          )}

          {activeTab === 'relationships' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Define this character's relationships with other characters
              </p>
              
              {allCharacters
                .filter((c) => c.id !== editedCharacter.id)
                .map((otherCharacter) => (
                  <div
                    key={otherCharacter.id}
                    className="flex items-center gap-4 p-4 border border-gray-200 dark:border-dark-border rounded-lg"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-dark-bg flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {otherCharacter.name}
                      </div>
                      <input
                        type="text"
                        value={editedCharacter.relationships?.[otherCharacter.id] || ''}
                        onChange={(e) => updateRelationship(otherCharacter.id, e.target.value)}
                        className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-dark-border rounded bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="e.g., Brother, Rival, Love interest..."
                      />
                    </div>
                  </div>
                ))}

              {allCharacters.filter((c) => c.id !== editedCharacter.id).length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                  No other characters yet. Create more characters to define relationships.
                </div>
              )}
            </div>
          )}

          {activeTab === 'custom' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Add custom attributes specific to your story
              </p>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newCustomKey}
                  onChange={(e) => setNewCustomKey(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Attribute name (e.g., 'Superpower')"
                />
                <input
                  type="text"
                  value={newCustomValue}
                  onChange={(e) => setNewCustomValue(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Value"
                  onKeyPress={(e) => e.key === 'Enter' && addCustomAttribute()}
                />
                <button
                  onClick={addCustomAttribute}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>

              <div className="space-y-2">
                {Object.entries(editedCharacter.customAttributes || {}).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-bg rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {key}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{value}</div>
                    </div>
                    <button
                      onClick={() => removeCustomAttribute(key)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {Object.keys(editedCharacter.customAttributes || {}).length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                    No custom attributes yet. Add some above.
                  </div>
                )}
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Additional Notes
                </label>
                <textarea
                  value={editedCharacter.notes || ''}
                  onChange={(e) => updateField('notes', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="Any additional notes about this character..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-dark-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-bg rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Character
          </button>
        </div>
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders when parent updates
// This is critical to prevent the infinite re-render loop that causes cursor jumping and crashes
export default memo(CharacterEditor, (prevProps, nextProps) => {
  // Only re-render if the character being edited changes (by ID)
  // Don't re-render just because allCharacters array reference changed
  const prevId = prevProps.character?.id;
  const nextId = nextProps.character?.id;
  
  // Return true to skip re-render (props are "equal")
  // Return false to re-render (props are "different")
  return prevId === nextId;
});

