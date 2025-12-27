import { useState, useEffect, useRef, useCallback } from 'react';
import { WebContainer } from '@webcontainer/api';
import type { Lesson } from '../lib/lessons';

type CodeBlockStatus = 'idle' | 'running' | 'success' | 'error';

interface CodeBlock {
  id: string;
  language: string;
  code: string;
  isRunnable: boolean;
  filePath?: string;
}

interface LessonContentProps {
  lesson: Lesson;
  isComplete: boolean;
  onMarkComplete: () => void;
  onPrevious: (() => void) | null;
  onNext: (() => void) | null;
  prevTitle: string | null;
  nextTitle: string | null;
  onRunCommand: (command: string) => void;
  webContainer: WebContainer | null;
}

/**
 * Parse code blocks from markdown content
 */
function parseCodeBlocks(markdown: string): CodeBlock[] {
  const codeBlockRegex = /```(\w+)?(?:\s+([^\n]*))?\n([\s\S]*?)```/g;
  const blocks: CodeBlock[] = [];
  let match;
  let index = 0;

  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const language = match[1] || '';
    const meta = match[2] || '';
    const code = match[3].trim();

    // Check for file path in meta (e.g., file="commands/hello.ts")
    const fileMatch = meta.match(/file=["']([^"']+)["']/);
    const filePath = fileMatch ? fileMatch[1] : undefined;

    // Check if this block is runnable:
    // - Blocks with file= metadata (file creation)
    // - Blocks with 'run' in metadata
    // - Bash/sh blocks
    const isRunnable =
      !!filePath || meta.includes('run') || language === 'bash' || language === 'sh';

    blocks.push({
      id: `code-block-${index++}`,
      language,
      code,
      isRunnable,
      filePath,
    });
  }

  return blocks;
}

export function LessonContent({
  lesson,
  isComplete,
  onMarkComplete,
  onPrevious,
  onNext,
  prevTitle,
  nextTitle,
  onRunCommand,
  webContainer,
}: LessonContentProps) {
  const [codeBlocks, setCodeBlocks] = useState<CodeBlock[]>([]);
  const [blockStatuses, setBlockStatuses] = useState<Map<string, CodeBlockStatus>>(new Map());
  const contentRef = useRef<HTMLDivElement>(null);

  // Parse code blocks when lesson changes
  useEffect(() => {
    const blocks = parseCodeBlocks(lesson.content);
    setCodeBlocks(blocks);
    setBlockStatuses(new Map(blocks.map((b) => [b.id, 'idle'])));
  }, [lesson.content]);

  // Inject run buttons into code blocks after render
  useEffect(() => {
    if (!contentRef.current) return;

    const preElements = contentRef.current.querySelectorAll('pre');

    preElements.forEach((pre, index) => {
      const block = codeBlocks[index];
      if (!block || !block.isRunnable) return;

      // Check if button already exists
      if (pre.querySelector('.run-button-container')) return;

      // Create button container
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'run-button-container';

      // Make pre position relative for absolute positioning
      pre.style.position = 'relative';
      pre.appendChild(buttonContainer);
    });
  }, [codeBlocks, lesson.htmlContent]);

  // Update button states when statuses change
  useEffect(() => {
    if (!contentRef.current) return;

    const preElements = contentRef.current.querySelectorAll('pre');

    preElements.forEach((pre, index) => {
      const block = codeBlocks[index];
      if (!block || !block.isRunnable) return;

      const status = blockStatuses.get(block.id) || 'idle';
      const buttonContainer = pre.querySelector('.run-button-container');
      if (!buttonContainer) return;

      // Update button content based on status
      buttonContainer.innerHTML = getButtonHtml(status);

      // Add click handler
      const button = buttonContainer.querySelector('.run-button');
      if (button && status !== 'running') {
        button.addEventListener('click', () => handleRun(block));
      }
    });
  }, [blockStatuses, codeBlocks]);

  const handleRun = useCallback(
    async (block: CodeBlock) => {
      setBlockStatuses((prev) => new Map(prev).set(block.id, 'running'));

      try {
        if (block.filePath && webContainer) {
          // File creation block - write to filesystem
          await writeFile(webContainer, block.filePath, block.code);
          // Echo what we did to terminal
          onRunCommand(`echo "Created ${block.filePath}"`);
        } else {
          // Shell command - send to terminal
          // Split by newlines and run each command
          const commands = block.code
            .split('\n')
            .filter((line) => line.trim() && !line.startsWith('#'));
          for (const cmd of commands) {
            onRunCommand(cmd);
            // Small delay between commands
            if (commands.length > 1) {
              await new Promise((r) => setTimeout(r, 100));
            }
          }
        }

        // Mark as success after a delay
        setTimeout(() => {
          setBlockStatuses((prev) => new Map(prev).set(block.id, 'success'));
          // Reset to idle after showing success
          setTimeout(() => {
            setBlockStatuses((prev) => new Map(prev).set(block.id, 'idle'));
          }, 2000);
        }, 500);
      } catch (error) {
        console.error('Failed to run code block:', error);
        setBlockStatuses((prev) => new Map(prev).set(block.id, 'error'));
        // Reset to idle after showing error
        setTimeout(() => {
          setBlockStatuses((prev) => new Map(prev).set(block.id, 'idle'));
        }, 3000);
      }
    },
    [onRunCommand, webContainer]
  );

  return (
    <div className="lesson-content">
      <div className="lesson-body">
        <div
          ref={contentRef}
          className="markdown-content"
          dangerouslySetInnerHTML={{ __html: lesson.htmlContent }}
        />
      </div>

      <div className="lesson-footer">
        <div className="lesson-completion">
          <button
            className={`complete-button ${isComplete ? 'completed' : ''}`}
            onClick={onMarkComplete}
          >
            {isComplete ? (
              <>
                <CheckIcon /> Completed
              </>
            ) : (
              'Mark Complete'
            )}
          </button>
        </div>

        <div className="lesson-navigation">
          <button
            className="nav-button prev"
            onClick={onPrevious ?? undefined}
            disabled={!onPrevious}
          >
            <ChevronLeftIcon />
            <span className="nav-label">
              <span className="nav-direction">Previous</span>
              {prevTitle && <span className="nav-title">{prevTitle}</span>}
            </span>
          </button>

          <button className="nav-button next" onClick={onNext ?? undefined} disabled={!onNext}>
            <span className="nav-label">
              <span className="nav-direction">Next</span>
              {nextTitle && <span className="nav-title">{nextTitle}</span>}
            </span>
            <ChevronRightIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Write a file to the WebContainer filesystem
 */
async function writeFile(container: WebContainer, path: string, content: string): Promise<void> {
  // Ensure parent directories exist
  const parts = path.split('/');
  if (parts.length > 1) {
    const dir = parts.slice(0, -1).join('/');
    try {
      await container.fs.mkdir(dir, { recursive: true });
    } catch {
      // Directory might already exist
    }
  }
  await container.fs.writeFile(path, content);
}

/**
 * Get button HTML based on status
 */
function getButtonHtml(status: CodeBlockStatus): string {
  switch (status) {
    case 'running':
      return `<button class="run-button running" disabled>
        <svg class="spinner" width="14" height="14" viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="20" stroke-dashoffset="10" />
        </svg>
        Running...
      </button>`;
    case 'success':
      return `<button class="run-button success" disabled>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="11 4 5.5 10 3 7.5" />
        </svg>
        Done
      </button>`;
    case 'error':
      return `<button class="run-button error" disabled>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="3" x2="11" y2="11" />
          <line x1="11" y1="3" x2="3" y2="11" />
        </svg>
        Error
      </button>`;
    default:
      return `<button class="run-button">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M3 1.5v9l7-4.5-7-4.5z" />
        </svg>
        Run
      </button>`;
  }
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="13 4 6 12 3 9" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="12 15 7 10 12 5" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="8 5 13 10 8 15" />
    </svg>
  );
}
