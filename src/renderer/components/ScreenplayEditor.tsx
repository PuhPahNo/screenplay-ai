import { useEffect, useRef, useState, KeyboardEvent, useCallback, forwardRef, useImperativeHandle } from 'react';
import { AutoFormatter } from '../../screenplay/auto-formatter';
import { FountainParserAdapter } from '../fountain/parser';
import type { ElementType } from '../../shared/types';
import '../styles/screenplay.css';

interface ScreenplayEditorProps {
  value: string;
  onChange: (value: string) => void;
  currentElement: ElementType;
  isFormatLocked: boolean;
  onCurrentElementChange: (type: ElementType) => void;
  onSave?: () => void;
  onStatusChange?: (status: EditorStatus) => void;
  theme?: 'light' | 'dark';
}

interface CursorPosition {
  lineIndex: number;
  offset: number;
}

export interface ScreenplayEditorHandle {
  /**
   * Scroll to a specific line by its zero-based index.
   * This matches the data-line-index attribute on each line div,
   * and corresponds to Scene.startLineIndex from SceneIndexer.
   */
  scrollToLine: (lineIndex: number) => void;
  applyFormat: (type: ElementType) => void;
}

export interface EditorStatus {
  elementType: ElementType;
  lineNumber: number;
  pageNumber: number;
  totalPages: number;
}

const ScreenplayEditor = forwardRef<ScreenplayEditorHandle, ScreenplayEditorProps>(({
  value,
  onChange,
  currentElement,
  isFormatLocked,
  onCurrentElementChange,
  onSave,
  onStatusChange,
  theme = 'dark',
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [_activeLineIndex, setActiveLineIndex] = useState<number | null>(null);
  const isUpdatingRef = useRef(false);
  const lastValueRef = useRef(value);

  // Initialize editor with content on mount and when value changes
  useEffect(() => {
    if (!editorRef.current) return;

    // Initialize if empty or if value changed externally
    if (!editorRef.current.hasChildNodes() || (value !== lastValueRef.current && !isUpdatingRef.current)) {
      const cursor = saveCursorPosition();
      initializeContent(value || '');
      if (cursor && editorRef.current.hasChildNodes()) {
        requestAnimationFrame(() => restoreCursorPosition(cursor));
      }
      lastValueRef.current = value;
    }
  }, [value]);

  // Update page count based on line count
  useEffect(() => {
    const LINES_PER_PAGE = 55;
    // const totalPages = Math.max(1, Math.ceil(lineCount / LINES_PER_PAGE));

    // Calculate current page based on cursor position
    const cursor = saveCursorPosition();
    if (cursor) {
      const currentPageNum = Math.max(1, Math.ceil((cursor.lineIndex + 1) / LINES_PER_PAGE));
      setCurrentPage(currentPageNum);
    } else {
      // Default to page 1 if no cursor (initial load)
      setCurrentPage(1);
    }
  }, [lineCount]);

  const initializeContent = (content: string) => {
    if (!editorRef.current) return;

    console.log('[ScreenplayEditor] Initializing content, length:', content?.length);

    // Normalize content to fix excessive blank lines
    const normalizedContent = FountainParserAdapter.normalizeContent(content || '');
    
    // Parse for better element detection
    const parsed = FountainParserAdapter.parse(normalizedContent);
    
    editorRef.current.innerHTML = '';

    // Use parsed tokens for accurate element typing
    if (parsed.tokens.length === 0) {
      // Empty document - create one blank line
      const lineDiv = createLineElement('', 0);
      editorRef.current.appendChild(lineDiv);
      setLineCount(1);
    } else {
      parsed.tokens.forEach((token, index) => {
        const lineDiv = createLineElementFromToken(token, index);
        editorRef.current!.appendChild(lineDiv);
      });
      setLineCount(parsed.tokens.length);
    }

    console.log('[ScreenplayEditor] Created', parsed.tokens.length, 'lines from normalized content');

    // Scroll to top after initializing content
    requestAnimationFrame(() => {
      if (editorRef.current) {
        editorRef.current.scrollTop = 0;
        console.log('[ScreenplayEditor] Scrolled to top (RAF)');
      }
    });
  };

  // Create line element from parsed token (more accurate)
  const createLineElementFromToken = (token: { type: ElementType; text: string }, index: number): HTMLDivElement => {
    const div = document.createElement('div');
    div.className = 'screenplay-line';
    div.setAttribute('data-line-index', index.toString());
    div.setAttribute('data-element-type', token.type);
    
    applyElementFormatting(div, token.type);
    div.textContent = token.text || '';
    
    return div;
  };

  const handleScroll = () => {
    if (!editorRef.current) return;

    // Calculate page based on scroll position
    // Standard page height is approx 1000-1100px depending on zoom/screen
    // We can also use the line-based logic if we find the first visible line

    const scrollTop = editorRef.current.scrollTop;
    // const pageHeight = editorRef.current.clientHeight; // Viewport height
    // This is rough. A better way is using lines.

    // Find first visible line
    const lines = editorRef.current.children;
    let firstVisibleLineIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] as HTMLElement;
      if (line.offsetTop >= scrollTop) {
        firstVisibleLineIndex = parseInt(line.getAttribute('data-line-index') || '0', 10);
        break;
      }
    }

    const LINES_PER_PAGE = 55;
    const newPage = Math.max(1, Math.ceil((firstVisibleLineIndex + 1) / LINES_PER_PAGE));
    if (newPage !== currentPage) {
      setCurrentPage(newPage);
    }
  };

  const createLineElement = (text: string, index: number): HTMLDivElement => {
    const div = document.createElement('div');
    div.className = 'screenplay-line';
    div.setAttribute('data-line-index', index.toString());

    // Detect element type
    const previousLine = index > 0 ? editorRef.current?.children[index - 1] : null;
    const previousType = previousLine?.getAttribute('data-element-type') as ElementType | undefined;
    const elementType = AutoFormatter.detectElementType(text, previousType);

    div.setAttribute('data-element-type', elementType);
    applyElementFormatting(div, elementType);

    div.textContent = text || '';

    return div;
  };

  const applyElementFormatting = (element: HTMLElement, type: ElementType) => {
    element.className = `screenplay-line screenplay-element ${type}`;
    element.setAttribute('data-element-type', type);

    const style = AutoFormatter.getElementStyle(type);
    Object.entries(style).forEach(([key, val]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      element.style.setProperty(cssKey, val as string);
    });
  };

  const saveCursorPosition = (): CursorPosition | null => {
    const selection = window.getSelection();
    if (!selection || !selection.anchorNode || !editorRef.current) return null;

    let node: Node | null = selection.anchorNode;
    let lineElement: HTMLElement | null = null;

    // Find the line element
    while (node && node !== editorRef.current) {
      if (node instanceof HTMLElement && node.classList.contains('screenplay-line')) {
        lineElement = node;
        break;
      }
      node = node.parentNode;
    }

    if (!lineElement) return null;

    const lineIndex = parseInt(lineElement.getAttribute('data-line-index') || '0');
    const offset = selection.anchorOffset;

    return { lineIndex, offset };
  };

  const restoreCursorPosition = (cursor: CursorPosition) => {
    if (!editorRef.current) return;

    const lines = editorRef.current.querySelectorAll('.screenplay-line');
    const targetLine = lines[cursor.lineIndex];

    if (!targetLine) return;

    const range = document.createRange();
    const selection = window.getSelection();

    if (!selection) return;

    try {
      const textNode = targetLine.firstChild;
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        const offset = Math.min(cursor.offset, textNode.textContent?.length || 0);
        range.setStart(textNode, offset);
        range.collapse(true);
      } else {
        range.setStart(targetLine, 0);
        range.collapse(true);
      }
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (error) {
      console.error('Failed to restore cursor:', error);
    }
  };

  const syncContentToState = () => {
    if (!editorRef.current || isUpdatingRef.current) return;

    const lines = Array.from(editorRef.current.querySelectorAll('.screenplay-line'));
    const content = lines.map(line => line.textContent || '').join('\n');

    if (content !== lastValueRef.current) {
      isUpdatingRef.current = true;
      lastValueRef.current = content;
      onChange(content);
      setLineCount(lines.length);
      requestAnimationFrame(() => {
        isUpdatingRef.current = false;
      });
    }
  };

  const getCurrentLine = (): HTMLElement | null => {
    const selection = window.getSelection();
    if (!selection || !selection.anchorNode) return null;

    let node: Node | null = selection.anchorNode;

    while (node && node !== editorRef.current) {
      if (node instanceof HTMLElement && node.classList.contains('screenplay-line')) {
        return node;
      }
      node = node.parentNode;
    }

    return null;
  };

  // Update active line highlighting and report status
  const updateActiveLine = useCallback(() => {
    if (!editorRef.current) return;

    const currentLine = getCurrentLine();
    
    // Remove active class from all lines
    const allLines = editorRef.current.querySelectorAll('.screenplay-line.active');
    allLines.forEach(line => line.classList.remove('active'));

    if (currentLine) {
      // Add active class to current line
      currentLine.classList.add('active');
      
      const lineIndex = parseInt(currentLine.getAttribute('data-line-index') || '0', 10);
      const elementType = currentLine.getAttribute('data-element-type') as ElementType || 'action';
      
      setActiveLineIndex(lineIndex);
      
      // Calculate page info
      const LINES_PER_PAGE = 55;
      const pageNumber = Math.max(1, Math.ceil((lineIndex + 1) / LINES_PER_PAGE));
      const totalPages = Math.max(1, Math.ceil(lineCount / LINES_PER_PAGE));
      
      // Report status to parent
      onStatusChange?.({
        elementType,
        lineNumber: lineIndex + 1,
        pageNumber,
        totalPages,
      });
    }
  }, [lineCount, onStatusChange]);

  const updateCurrentLineFormatting = useCallback((type: ElementType) => {
    const currentLine = getCurrentLine();
    if (!currentLine) return;

    const cursor = saveCursorPosition();
    applyElementFormatting(currentLine, type);

    if (cursor) {
      requestAnimationFrame(() => restoreCursorPosition(cursor));
    }

    syncContentToState();
  }, []);

  const handleInput = () => {
    if (!editorRef.current) return;

    const currentLine = getCurrentLine();

    // If user is typing and format is not locked, auto-detect format
    if (currentLine && !isFormatLocked) {
      const text = currentLine.textContent || '';
      const lineIndex = parseInt(currentLine.getAttribute('data-line-index') || '0');

      const previousLine = lineIndex > 0 ? editorRef.current.children[lineIndex - 1] : null;
      const previousType = previousLine?.getAttribute('data-element-type') as ElementType | undefined;

      const detectedType = AutoFormatter.detectElementType(text, previousType);
      const currentType = currentLine.getAttribute('data-element-type') as ElementType;

      if (detectedType !== currentType) {
        applyElementFormatting(currentLine, detectedType);
        onCurrentElementChange(detectedType);
      }
    }

    syncContentToState();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Save shortcut
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      onSave?.();
      return;
    }

    // Tab: Cycle through element types
    if (e.key === 'Tab') {
      e.preventDefault();
      cycleElementType();
      return;
    }

    // Enter: Create new line with smart formatting
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEnterKey();
      return;
    }

    // Formatting shortcuts
    if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
      let newType: ElementType | null = null;

      switch (e.key.toLowerCase()) {
        case 'h':
          newType = 'scene-heading';
          break;
        case 'a':
          newType = 'action';
          break;
        case 'c':
          newType = 'character';
          break;
        case 'd':
          newType = 'dialogue';
          break;
      }

      if (newType) {
        e.preventDefault();
        updateCurrentLineFormatting(newType);
        onCurrentElementChange(newType);
      }
    }
  };

  const handleEnterKey = () => {
    if (!editorRef.current) return;

    const selection = window.getSelection();
    if (!selection || !selection.anchorNode) return;

    const currentLine = getCurrentLine();
    if (!currentLine) return;

    const currentType = currentLine.getAttribute('data-element-type') as ElementType;
    const nextType = isFormatLocked ? currentElement : AutoFormatter.getNextElementType(currentType);

    // Get current line index
    const currentIndex = parseInt(currentLine.getAttribute('data-line-index') || '0');

    // Create new line
    const newLine = document.createElement('div');
    newLine.className = `screenplay-line screenplay-element ${nextType}`;
    newLine.setAttribute('data-line-index', (currentIndex + 1).toString());
    newLine.setAttribute('data-element-type', nextType);
    applyElementFormatting(newLine, nextType);
    newLine.textContent = '';

    // Insert new line after current
    currentLine.after(newLine);

    // Update line indices for all following lines
    let nextSibling = newLine.nextElementSibling;
    let index = currentIndex + 2;
    while (nextSibling) {
      nextSibling.setAttribute('data-line-index', index.toString());
      index++;
      nextSibling = nextSibling.nextElementSibling;
    }

    // Move cursor to new line
    const range = document.createRange();
    range.setStart(newLine, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    onCurrentElementChange(nextType);
    syncContentToState();
  };

  const cycleElementType = () => {
    const types: ElementType[] = [
      'action',
      'scene-heading',
      'character',
      'dialogue',
      'parenthetical',
      'transition',
    ];

    const currentIndex = types.indexOf(currentElement);
    const nextIndex = (currentIndex + 1) % types.length;
    const nextType = types[nextIndex];

    updateCurrentLineFormatting(nextType);
    onCurrentElementChange(nextType);
  };

  // Update formatting when format is locked and element changes
  useEffect(() => {
    if (isFormatLocked) {
      updateCurrentLineFormatting(currentElement);
    }
  }, [currentElement, isFormatLocked, updateCurrentLineFormatting]);

  // Debug logging
  useEffect(() => {
    console.log('[ScreenplayEditor] Props changed - value length:', value?.length, 'currentElement:', currentElement);
  }, [value, currentElement]);

  /**
   * Scroll to a line by its zero-based index (matches data-line-index attribute).
   * Use Scene.startLineIndex from SceneIndexer for scene navigation.
   */
  const scrollToLine = useCallback((lineIndex: number) => {
    if (!editorRef.current) return;

    console.log('[ScreenplayEditor] scrollToLine called with lineIndex:', lineIndex);
    const lineElement = editorRef.current.querySelector(`[data-line-index="${lineIndex}"]`);
    if (lineElement) {
      console.log('[ScreenplayEditor] Found line element, scrolling to:', lineElement.textContent?.substring(0, 50));
      lineElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Highlight the line briefly
      lineElement.classList.add('highlight-line');
      setTimeout(() => {
        lineElement.classList.remove('highlight-line');
      }, 2000);
    } else {
      console.warn('[ScreenplayEditor] No line element found for index:', lineIndex);
    }
  }, []);

  // Method to apply a format from toolbar click
  const applyFormat = useCallback((type: ElementType) => {
    updateCurrentLineFormatting(type);
    onCurrentElementChange(type);
  }, [updateCurrentLineFormatting, onCurrentElementChange]);

  useImperativeHandle(ref, () => ({
    scrollToLine,
    applyFormat,
  }), [scrollToLine, applyFormat]);

  // Handle click to update active line
  const handleClick = () => {
    updateActiveLine();
  };

  // Handle selection change (for keyboard navigation)
  useEffect(() => {
    const handleSelectionChange = () => {
      if (editorRef.current?.contains(document.activeElement)) {
        updateActiveLine();
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [updateActiveLine]);

  return (
    <div className={`screenplay-container ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="screenplay-page">
        <div className="screenplay-page-header">
          Page {currentPage} of {Math.max(1, Math.ceil(lineCount / 55))}
        </div>
        <div
          ref={editorRef}
          className="screenplay-content"
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          onClick={handleClick}
          data-placeholder="Start writing your screenplay..."
          suppressContentEditableWarning
        />
      </div>
    </div>
  );
});

ScreenplayEditor.displayName = 'ScreenplayEditor';

export default ScreenplayEditor;
