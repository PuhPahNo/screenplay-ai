import { useState } from 'react';
import { useAppStore } from '../store/app-store';
import { FileText, File, Droplet } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const { currentProject, screenplayContent } = useAppStore();
  const [format, setFormat] = useState<'pdf' | 'fdx' | 'fountain'>('pdf');
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    if (!currentProject) return;

    setIsExporting(true);
    try {
      const filters = {
        pdf: [{ name: 'PDF Files', extensions: ['pdf'] }],
        fdx: [{ name: 'Final Draft Files', extensions: ['fdx'] }],
        fountain: [{ name: 'Fountain Files', extensions: ['fountain'] }],
      };

      const defaultName = `${currentProject.name}.${format}`;
      const savePath = await (window.api.file as any).saveDialog(defaultName, filters[format]);

      if (savePath) {
        if (format === 'pdf') {
          await window.api.file.exportPDF(screenplayContent, savePath);
        } else if (format === 'fdx') {
          await (window.api.file as any).exportFDX(screenplayContent, savePath);
        } else {
          // Fountain - just save the raw content
          await window.api.project.save(screenplayContent);
          // Copy to export location
          const fs = require('fs');
          fs.copyFileSync(
            `${currentProject.path}/screenplay.fountain`,
            savePath
          );
        }

        alert('Export successful!');
        onClose();
      }
    } catch (error) {
      alert('Export failed: ' + error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-surface rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <h2 className="text-2xl font-bold mb-6">Export Screenplay</h2>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-3">Export Format</label>
          <div className="space-y-2">
            <button
              onClick={() => setFormat('pdf')}
              className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                format === 'pdf'
                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-300 dark:border-dark-border'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                <div>
                  <div className="font-semibold">PDF</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Industry-standard format for sharing
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => setFormat('fdx')}
              className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                format === 'fdx'
                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-300 dark:border-dark-border'
              }`}
            >
              <div className="flex items-center gap-3">
                <File className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                <div>
                  <div className="font-semibold">Final Draft (FDX)</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Compatible with Final Draft software
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => setFormat('fountain')}
              className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                format === 'fountain'
                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-300 dark:border-dark-border'
              }`}
            >
              <div className="flex items-center gap-3">
                <Droplet className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                <div>
                  <div className="font-semibold">Fountain</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Plain text format, editable anywhere
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}

