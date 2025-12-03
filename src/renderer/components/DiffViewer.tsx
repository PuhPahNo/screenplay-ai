import React, { useMemo } from 'react';

interface DiffViewerProps {
  oldText: string;
  newText: string;
  oldTitle?: string;
  newTitle?: string;
}

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  lineNumber?: number;
}

/**
 * Simple line-by-line diff algorithm
 * Uses Longest Common Subsequence (LCS) approach
 */
function computeDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const result: DiffLine[] = [];
  
  // Build LCS matrix
  const m = oldLines.length;
  const n = newLines.length;
  const lcs: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
    }
  }
  
  // Backtrack to find diff
  let i = m;
  let j = n;
  const diffStack: DiffLine[] = [];
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diffStack.push({ type: 'unchanged', content: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      diffStack.push({ type: 'added', content: newLines[j - 1] });
      j--;
    } else {
      diffStack.push({ type: 'removed', content: oldLines[i - 1] });
      i--;
    }
  }
  
  // Reverse to get correct order
  while (diffStack.length > 0) {
    result.push(diffStack.pop()!);
  }
  
  return result;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  oldText,
  newText,
  oldTitle = 'Previous Version',
  newTitle = 'Current Version',
}) => {
  const diff = useMemo(() => {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    return computeDiff(oldLines, newLines);
  }, [oldText, newText]);

  // Separate into old and new panels
  const { oldPanel, newPanel } = useMemo(() => {
    const oldLines: { type: DiffLine['type']; content: string; lineNum: number }[] = [];
    const newLines: { type: DiffLine['type']; content: string; lineNum: number }[] = [];
    
    let oldLineNum = 1;
    let newLineNum = 1;
    
    for (const line of diff) {
      if (line.type === 'unchanged') {
        oldLines.push({ type: 'unchanged', content: line.content, lineNum: oldLineNum++ });
        newLines.push({ type: 'unchanged', content: line.content, lineNum: newLineNum++ });
      } else if (line.type === 'removed') {
        oldLines.push({ type: 'removed', content: line.content, lineNum: oldLineNum++ });
        newLines.push({ type: 'removed', content: '', lineNum: -1 }); // Placeholder
      } else if (line.type === 'added') {
        oldLines.push({ type: 'added', content: '', lineNum: -1 }); // Placeholder
        newLines.push({ type: 'added', content: line.content, lineNum: newLineNum++ });
      }
    }
    
    return { oldPanel: oldLines, newPanel: newLines };
  }, [diff]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const line of diff) {
      if (line.type === 'added') added++;
      if (line.type === 'removed') removed++;
    }
    return { added, removed };
  }, [diff]);

  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      <div className="flex items-center gap-4 px-4 py-2 bg-gray-100 dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border text-sm">
        <span className="text-green-600 dark:text-green-400">
          +{stats.added} added
        </span>
        <span className="text-red-600 dark:text-red-400">
          -{stats.removed} removed
        </span>
      </div>
      
      {/* Side-by-side view */}
      <div className="flex-1 flex overflow-hidden">
        {/* Old version */}
        <div className="flex-1 flex flex-col border-r border-gray-200 dark:border-dark-border">
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-gray-200 dark:border-dark-border">
            <span className="text-sm font-medium text-red-700 dark:text-red-400">
              {oldTitle}
            </span>
          </div>
          <div className="flex-1 overflow-auto font-mono text-sm">
            {oldPanel.map((line, idx) => (
              <div
                key={`old-${idx}`}
                className={`flex ${
                  line.type === 'removed'
                    ? 'bg-red-100 dark:bg-red-900/30'
                    : line.type === 'added'
                    ? 'bg-gray-50 dark:bg-dark-border/30'
                    : ''
                }`}
              >
                <div className="w-12 flex-shrink-0 px-2 py-0.5 text-right text-gray-400 dark:text-gray-600 select-none border-r border-gray-200 dark:border-dark-border">
                  {line.lineNum > 0 ? line.lineNum : ''}
                </div>
                <div className="flex-1 px-2 py-0.5 whitespace-pre-wrap break-words">
                  {line.type === 'removed' && (
                    <span className="text-red-700 dark:text-red-400">
                      {line.content || '\u00A0'}
                    </span>
                  )}
                  {line.type === 'unchanged' && (
                    <span className="text-gray-800 dark:text-gray-300">
                      {line.content || '\u00A0'}
                    </span>
                  )}
                  {line.type === 'added' && (
                    <span className="text-gray-400 dark:text-gray-600">
                      {'\u00A0'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* New version */}
        <div className="flex-1 flex flex-col">
          <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20 border-b border-gray-200 dark:border-dark-border">
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              {newTitle}
            </span>
          </div>
          <div className="flex-1 overflow-auto font-mono text-sm">
            {newPanel.map((line, idx) => (
              <div
                key={`new-${idx}`}
                className={`flex ${
                  line.type === 'added'
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : line.type === 'removed'
                    ? 'bg-gray-50 dark:bg-dark-border/30'
                    : ''
                }`}
              >
                <div className="w-12 flex-shrink-0 px-2 py-0.5 text-right text-gray-400 dark:text-gray-600 select-none border-r border-gray-200 dark:border-dark-border">
                  {line.lineNum > 0 ? line.lineNum : ''}
                </div>
                <div className="flex-1 px-2 py-0.5 whitespace-pre-wrap break-words">
                  {line.type === 'added' && (
                    <span className="text-green-700 dark:text-green-400">
                      {line.content || '\u00A0'}
                    </span>
                  )}
                  {line.type === 'unchanged' && (
                    <span className="text-gray-800 dark:text-gray-300">
                      {line.content || '\u00A0'}
                    </span>
                  )}
                  {line.type === 'removed' && (
                    <span className="text-gray-400 dark:text-gray-600">
                      {'\u00A0'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiffViewer;

