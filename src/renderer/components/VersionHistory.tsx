import React, { useState, useEffect } from 'react';
import { 
  GitBranch, Plus, Trash2, RotateCcw, X, 
  Clock, ChevronRight, ChevronDown, FileText
} from 'lucide-react';
import type { VersionSummary, Version } from '../../shared/types';

interface VersionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({ isOpen, onClose }) => {
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newVersionMessage, setNewVersionMessage] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'view'>('list');

  // Load versions on mount
  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen]);

  const loadVersions = async () => {
    try {
      setIsLoading(true);
      const versionList = await window.api.version.list();
      setVersions(versionList);
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createVersion = async () => {
    if (!newVersionMessage.trim()) return;
    
    try {
      setIsCreating(true);
      await window.api.version.create(newVersionMessage.trim());
      setNewVersionMessage('');
      setShowCreateForm(false);
      await loadVersions();
    } catch (error) {
      console.error('Failed to create version:', error);
      alert('Failed to create version');
    } finally {
      setIsCreating(false);
    }
  };

  const viewVersion = async (id: string) => {
    try {
      setIsLoading(true);
      const version = await window.api.version.get(id);
      setSelectedVersion(version);
      setViewMode('view');
    } catch (error) {
      console.error('Failed to load version:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const restoreVersion = async (id: string) => {
    const confirm = window.confirm(
      'Are you sure you want to restore this version? A backup will be created before restoring.'
    );
    
    if (!confirm) return;
    
    try {
      setIsLoading(true);
      await window.api.version.restore(id);
      alert('Version restored successfully! Please reload the project to see changes.');
      onClose();
    } catch (error) {
      console.error('Failed to restore version:', error);
      alert('Failed to restore version');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteVersion = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const confirm = window.confirm('Are you sure you want to delete this version?');
    if (!confirm) return;
    
    try {
      await window.api.version.delete(id);
      await loadVersions();
    } catch (error) {
      console.error('Failed to delete version:', error);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl w-[800px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <div className="flex items-center gap-3">
            <GitBranch className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Version History
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-border transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {viewMode === 'list' ? (
            <div className="flex-1 flex flex-col">
              {/* Create Version Button */}
              <div className="p-4 border-b border-gray-200 dark:border-dark-border">
                {showCreateForm ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newVersionMessage}
                      onChange={(e) => setNewVersionMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && createVersion()}
                      placeholder="Version message (e.g., 'Added Act 2 climax')"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      autoFocus
                    />
                    <button
                      onClick={createVersion}
                      disabled={isCreating || !newVersionMessage.trim()}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isCreating ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewVersionMessage('');
                      }}
                      className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-border rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Version
                  </button>
                )}
              </div>

              {/* Version List */}
              <div className="flex-1 overflow-y-auto p-4">
                {isLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
                  </div>
                ) : versions.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <GitBranch className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No versions yet</p>
                    <p className="text-sm mt-1">Create a version to save a snapshot of your screenplay</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {versions.map((version) => (
                      <div
                        key={version.id}
                        className="group flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-dark-border hover:border-primary-300 dark:hover:border-primary-600 hover:bg-gray-50 dark:hover:bg-dark-bg cursor-pointer transition-colors"
                        onClick={() => viewVersion(version.id)}
                      >
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {version.message}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(version.createdAt)}
                            </span>
                            <span>{formatSize(version.contentLength)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              restoreVersion(version.id);
                            }}
                            className="p-2 text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-border"
                            title="Restore this version"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => deleteVersion(version.id, e)}
                            className="p-2 text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-border"
                            title="Delete this version"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // View Mode - Show version content
            <div className="flex-1 flex flex-col">
              {/* Back button */}
              <div className="p-4 border-b border-gray-200 dark:border-dark-border flex items-center justify-between">
                <button
                  onClick={() => {
                    setViewMode('list');
                    setSelectedVersion(null);
                  }}
                  className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  <ChevronDown className="w-4 h-4 rotate-90" />
                  Back to list
                </button>
                {selectedVersion && (
                  <button
                    onClick={() => restoreVersion(selectedVersion.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Restore This Version
                  </button>
                )}
              </div>
              
              {/* Version content */}
              {selectedVersion && (
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="mb-4">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {selectedVersion.message}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(selectedVersion.createdAt)}
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-dark-bg rounded-lg p-4 font-mono text-sm overflow-x-auto whitespace-pre-wrap">
                    {selectedVersion.content || 'No content in this version'}
                  </div>
                  
                  {selectedVersion.charactersSnapshot && selectedVersion.charactersSnapshot.length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                        Characters ({selectedVersion.charactersSnapshot.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedVersion.charactersSnapshot.map((char) => (
                          <span
                            key={char.id}
                            className="px-2 py-1 bg-gray-100 dark:bg-dark-border rounded text-sm"
                          >
                            {char.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VersionHistory;

