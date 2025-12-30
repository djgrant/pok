import { useState, useEffect, useCallback, useMemo } from 'react';
import { WebContainer } from '@webcontainer/api';
import { UseEventBusResult, PlaygroundEvent } from '../hooks/useEventBus';

interface FileViewerProps {
  filePath: string;
  webcontainer: WebContainer;
  eventBus?: UseEventBusResult;
}

export function FileViewer({ filePath, webcontainer, eventBus }: FileViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFile = useCallback(async () => {
    if (!webcontainer || !filePath) return;

    setLoading(true);
    setError(null);

    try {
      const fileContent = await webcontainer.fs.readFile(filePath, 'utf-8');
      setContent(fileContent);
    } catch (err) {
      setError(`Unable to read file: ${filePath}`);
      console.error('FileViewer load error:', err);
    } finally {
      setLoading(false);
    }
  }, [webcontainer, filePath]);

  // Load file on mount and path change
  useEffect(() => {
    loadFile();
  }, [loadFile]);

  // Subscribe to event bus for file updates
  useEffect(() => {
    if (!eventBus) return;

    const handleUpdate = (event: PlaygroundEvent) => {
      if (event.type === 'file:updated' && event.path === filePath) {
        loadFile();
      }
    };

    const unsub = eventBus.subscribe('file:updated', handleUpdate);
    return () => unsub();
  }, [eventBus, filePath, loadFile]);

  const extension = useMemo(() => getExtension(filePath), [filePath]);
  const language = useMemo(() => getLanguage(extension), [extension]);

  if (loading) {
    return (
      <div className="file-viewer file-viewer-loading">
        <span className="text-muted">Loading {filePath}...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="file-viewer file-viewer-error">
        <div className="file-viewer-error-icon">
          <ErrorIcon />
        </div>
        <div className="file-viewer-error-message">{error}</div>
      </div>
    );
  }

  if (content === null) {
    return null;
  }

  return (
    <div className="file-viewer">
      <div className="file-viewer-header">
        <span className="file-viewer-path">{filePath}</span>
        <span className="file-viewer-lang">{language}</span>
      </div>
      <div className="file-viewer-content">
        <CodeBlock content={content} language={language} />
      </div>
    </div>
  );
}

interface CodeBlockProps {
  content: string;
  language: string;
}

function CodeBlock({ content, language }: CodeBlockProps) {
  const lines = content.split('\n');
  const lineNumberWidth = String(lines.length).length;

  return (
    <pre className={`code-block language-${language}`}>
      <code>
        {lines.map((line, i) => (
          <div key={i} className="code-line">
            <span
              className="code-line-number"
              style={{ minWidth: `${lineNumberWidth + 1}ch` }}
            >
              {i + 1}
            </span>
            <span className="code-line-content">
              <HighlightedLine line={line} language={language} />
            </span>
          </div>
        ))}
      </code>
    </pre>
  );
}

interface HighlightedLineProps {
  line: string;
  language: string;
}

// Simple syntax highlighting - just basic token coloring
function HighlightedLine({ line, language }: HighlightedLineProps) {
  // For now, do very basic highlighting based on language
  const highlighted = useMemo(() => {
    if (!line.trim()) {
      return <span>{line || ' '}</span>;
    }

    if (language === 'json') {
      return <JsonHighlight line={line} />;
    }

    if (language === 'typescript' || language === 'javascript') {
      return <TsHighlight line={line} />;
    }

    return <span>{line}</span>;
  }, [line, language]);

  return highlighted;
}

function JsonHighlight({ line }: { line: string }) {
  // Very simple JSON highlighting
  const parts: React.ReactNode[] = [];
  let remaining = line;
  let key = 0;

  // Match strings
  const stringRegex = /"([^"\\]|\\.)*"/g;
  let match;
  let lastIndex = 0;

  while ((match = stringRegex.exec(remaining)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      const before = remaining.slice(lastIndex, match.index);
      // Check for numbers, booleans, null
      parts.push(
        <span key={key++}>
          {highlightJsonValues(before)}
        </span>
      );
    }

    // The string itself - check if it's a key (followed by :)
    const afterMatch = remaining.slice(match.index + match[0].length);
    const isKey = /^\s*:/.test(afterMatch);

    parts.push(
      <span key={key++} className={isKey ? 'token-key' : 'token-string'}>
        {match[0]}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last match
  if (lastIndex < remaining.length) {
    parts.push(
      <span key={key++}>
        {highlightJsonValues(remaining.slice(lastIndex))}
      </span>
    );
  }

  return <>{parts.length > 0 ? parts : line}</>;
}

function highlightJsonValues(text: string): React.ReactNode {
  // Highlight numbers, booleans, null
  const parts: React.ReactNode[] = [];
  const valueRegex = /\b(true|false|null|\d+\.?\d*)\b/g;
  let match;
  let lastIndex = 0;
  let key = 0;

  while ((match = valueRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }

    const value = match[1];
    const className =
      value === 'true' || value === 'false'
        ? 'token-boolean'
        : value === 'null'
          ? 'token-null'
          : 'token-number';

    parts.push(
      <span key={key++} className={className}>
        {value}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? <>{parts}</> : text;
}

function TsHighlight({ line }: { line: string }) {
  // Very simple TS/JS highlighting
  const parts: React.ReactNode[] = [];
  let remaining = line;
  let key = 0;

  // Keywords
  const keywords = /\b(import|export|from|const|let|var|function|async|await|return|if|else|for|while|class|interface|type|extends|implements|new|this|super|static|public|private|protected|readonly|as|typeof|keyof|infer|enum|namespace|module|declare)\b/g;
  
  // Comments (single line)
  if (remaining.trim().startsWith('//')) {
    return <span className="token-comment">{line}</span>;
  }

  // Process the line
  let lastIndex = 0;
  let match;

  // First, handle strings
  const stringRegex = /(['"`])(?:(?!\1)[^\\]|\\.)*\1/g;
  const strings: Array<{ start: number; end: number; text: string }> = [];

  while ((match = stringRegex.exec(remaining)) !== null) {
    strings.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
  }

  // Now process with keyword highlighting, avoiding strings
  keywords.lastIndex = 0;
  const tokens: Array<{ start: number; end: number; text: string; type: string }> = [];

  while ((match = keywords.exec(remaining)) !== null) {
    // Check if this keyword is inside a string
    const inString = strings.some((s) => match!.index >= s.start && match!.index < s.end);
    if (!inString) {
      tokens.push({ start: match.index, end: match.index + match[0].length, text: match[0], type: 'keyword' });
    }
  }

  // Add strings as tokens
  for (const s of strings) {
    tokens.push({ start: s.start, end: s.end, text: s.text, type: 'string' });
  }

  // Sort tokens by position
  tokens.sort((a, b) => a.start - b.start);

  // Build output
  for (const token of tokens) {
    if (token.start > lastIndex) {
      parts.push(<span key={key++}>{remaining.slice(lastIndex, token.start)}</span>);
    }
    parts.push(
      <span key={key++} className={`token-${token.type}`}>
        {token.text}
      </span>
    );
    lastIndex = token.end;
  }

  if (lastIndex < remaining.length) {
    parts.push(<span key={key++}>{remaining.slice(lastIndex)}</span>);
  }

  return <>{parts.length > 0 ? parts : line}</>;
}

function getExtension(filePath: string): string {
  const parts = filePath.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function getLanguage(extension: string): string {
  const languages: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    html: 'html',
    yml: 'yaml',
    yaml: 'yaml',
    sh: 'bash',
    bash: 'bash',
  };
  return languages[extension] || 'text';
}

function ErrorIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1">
      <circle cx="8" cy="8" r="7" />
      <line x1="8" y1="4" x2="8" y2="9" />
      <circle cx="8" cy="11.5" r="0.5" fill="currentColor" />
    </svg>
  );
}
