/**
 * TutorialPanel - Complete tutorial panel for the playground
 *
 * Combines the tutorial engine with renderer components to create
 * the full interactive tutorial experience.
 */

import { useRef, useEffect, type ReactNode } from 'react';
import type { TutorialStep as TutorialStepType } from '../tutorial';
import { useTutorialEngine } from '../hooks/useTutorialEngine';
import type { StepStatus } from '../hooks/useTutorialEngine';
import './TutorialPanel.css';

// ============================================
// Inline Headless Components
// These are simplified versions of the reporter-web components,
// adapted to work with React 19 types.
// ============================================

type TutorialStepStatus = 'pending' | 'active' | 'complete';

function TutorialStep({
  number,
  title,
  status,
  children,
}: {
  number: number;
  title: string;
  status: TutorialStepStatus;
  children: ReactNode;
}) {
  return (
    <div className="tutorial-step" data-status={status}>
      <div className="tutorial-step-header">
        <span className="tutorial-step-number">{number}</span>
        <span className="tutorial-step-title">{title}</span>
      </div>
      <div className="tutorial-step-content">{children}</div>
    </div>
  );
}

type FilePreviewStatus = 'pending' | 'creating' | 'created';

function FilePreview({
  path,
  content,
  language,
  status,
  onAction,
}: {
  path: string;
  content: string;
  language?: string;
  status: FilePreviewStatus;
  onAction?: () => void;
}) {
  const disabled = status === 'creating' || status === 'created';
  const isLoading = status === 'creating';

  return (
    <div className="file-preview" data-status={status} data-language={language}>
      <div className="file-preview-header">
        <span className="file-preview-path">{path}</span>
        {language && <span className="file-preview-language">{language}</span>}
      </div>
      <div className="file-preview-content">
        <pre className="file-preview-code">
          <code>{content}</code>
        </pre>
      </div>
      {onAction && (
        <div className="file-preview-actions">
          <button
            className="file-preview-action-button"
            onClick={onAction}
            disabled={disabled}
            data-status={status}
            data-loading={isLoading ? 'true' : undefined}
            aria-busy={isLoading}
          >
            {status === 'pending' && 'Create'}
            {status === 'creating' && (
              <>
                <span aria-hidden="true">Creating...</span>
                <span className="sr-only">Creating file, please wait</span>
              </>
            )}
            {status === 'created' && 'Created'}
          </button>
        </div>
      )}
    </div>
  );
}

type CommandBlockStatus = 'idle' | 'running' | 'complete' | 'failed';

function CommandBlock({
  command,
  status,
  output,
  onRun,
}: {
  command: string;
  status: CommandBlockStatus;
  output?: string[];
  onRun?: () => void;
}) {
  const disabled = status === 'running';
  const isLoading = status === 'running';

  return (
    <div className="command-block" data-status={status}>
      <div className="command-block-command">
        <span className="command-block-prompt">$</span>
        <span className="command-block-text">{command}</span>
      </div>
      {output && output.length > 0 && (
        <div className="command-block-output">
          {output.map((line, index) => (
            <div key={index} className="command-block-output-line">
              {line}
            </div>
          ))}
        </div>
      )}
      {onRun && (
        <div className="command-block-actions">
          <button
            className="command-block-action-button"
            onClick={onRun}
            disabled={disabled}
            data-status={status}
            data-loading={isLoading ? 'true' : undefined}
            aria-busy={isLoading}
          >
            {status === 'idle' && 'Run'}
            {status === 'running' && (
              <>
                <span aria-hidden="true">Running...</span>
                <span className="sr-only">Running command, please wait</span>
              </>
            )}
            {status === 'complete' && 'Run Again'}
            {status === 'failed' && 'Retry'}
          </button>
        </div>
      )}
    </div>
  );
}

function ProgressIndicator({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label?: string;
}) {
  const progress = total > 0 ? current / total : 0;
  const isComplete = current >= total;
  const displayLabel = label ?? `Step ${current} of ${total}`;

  return (
    <div
      className="progress-indicator"
      data-progress={progress.toFixed(2)}
      data-complete={isComplete ? 'true' : undefined}
    >
      <span className="progress-indicator-label">{displayLabel}</span>
      <div className="progress-indicator-bar">
        <div
          className="progress-indicator-fill"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}

type ContentBoxVariant = 'info' | 'tip' | 'warning';

function ContentBox({
  variant,
  title,
  children,
}: {
  variant: ContentBoxVariant;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="content-box" data-variant={variant}>
      {title && <div className="content-box-title">{title}</div>}
      <div className="content-box-content">{children}</div>
    </div>
  );
}

// ============================================
// End Inline Components
// ============================================

export type TutorialPanelProps = {
  /** Callback to create a file in WebContainer */
  onCreateFile?: (path: string, content: string) => Promise<void>;
  /** Callback to run a command in WebContainer */
  onRunCommand?: (command: string) => Promise<void>;
  /** Callback to open a file in the editor */
  onOpenFile?: (path: string) => void;
  /** Whether an action is in progress */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Callback to clear error */
  onClearError?: () => void;
  /** Whether to render header externally (header info passed via renderHeader) */
  externalHeader?: boolean;
};

/** Tutorial header info for external rendering */
export type TutorialHeaderInfo = {
  sectionTitle: string;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
};

// Track file creation status
type FileStatus = 'pending' | 'creating' | 'created';
type CommandStatus = 'idle' | 'running' | 'complete' | 'failed';

/** Hook to get tutorial header info for external rendering */
export function useTutorialHeaderInfo(): TutorialHeaderInfo {
  const { currentSection, progress } = useTutorialEngine();
  return {
    sectionTitle: currentSection.title,
    progress,
  };
}

/** Reusable progress indicator for header */
export { ProgressIndicator };

export function TutorialPanel({
  onCreateFile,
  onRunCommand,
  onOpenFile,
  isLoading = false,
  error = null,
  onClearError,
  externalHeader = false,
}: TutorialPanelProps) {
  const {
    currentSection,
    currentSectionIndex,
    currentStepIndex,
    progress,
    getStepStatus,
    completeStepAndProgress,
    selectChoice,
    goToSection,
    selectedChoice,
  } = useTutorialEngine();

  // Ref for auto-scroll
  const activeStepRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active step
  useEffect(() => {
    if (activeStepRef.current) {
      const timer = setTimeout(() => {
        activeStepRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentStepIndex, currentSectionIndex]);

  // Get display title for a step
  const getStepTitle = (step: TutorialStepType): string => {
    switch (step.type) {
      case 'info':
        return step.title;
      case 'file-create':
        return step.description;
      case 'command-run':
        return step.description;
      case 'tip':
        return 'Tip';
      case 'warning':
        return 'Warning';
      case 'code-display':
        return step.description || 'Code';
      case 'choice':
        return step.message;
      default:
        return 'Step';
    }
  };

  // Handle file creation action
  const handleCreateFile = async (path: string, content: string, stepIndex: number) => {
    if (onCreateFile) {
      await onCreateFile(path, content);
    }
    // Mark step as complete
    if (stepIndex === currentStepIndex) {
      completeStepAndProgress();
    }
    // Open the file
    if (onOpenFile) {
      onOpenFile(path);
    }
  };

  // Handle command run action
  const handleRunCommand = async (command: string, stepIndex: number) => {
    if (onRunCommand) {
      await onRunCommand(command);
    }
    // Mark step as complete
    if (stepIndex === currentStepIndex) {
      completeStepAndProgress();
    }
  };

  // Handle choice selection
  const handleChoiceSelect = (value: string) => {
    selectChoice(value);
    // Navigate to the selected section
    goToSection(value);
  };

  // Convert our step status to component status
  const toTutorialStepStatus = (status: StepStatus): 'pending' | 'active' | 'complete' => {
    return status;
  };

  // Convert our step status to file preview status
  const toFilePreviewStatus = (status: StepStatus): FileStatus => {
    if (status === 'complete') return 'created';
    return 'pending';
  };

  // Convert our step status to command block status
  const toCommandBlockStatus = (status: StepStatus): CommandStatus => {
    if (status === 'complete') return 'complete';
    return 'idle';
  };

  // Render step content based on type
  const renderStepContent = (step: TutorialStepType, stepIndex: number, status: StepStatus) => {
    switch (step.type) {
      case 'info':
        return (
          <ContentBox variant="info">
            {step.content}
          </ContentBox>
        );

      case 'file-create':
        return (
          <FilePreview
            path={step.path}
            content={step.content}
            language={getLanguageFromPath(step.path)}
            status={toFilePreviewStatus(status)}
            onAction={() => handleCreateFile(step.path, step.content, stepIndex)}
          />
        );

      case 'command-run':
        return (
          <CommandBlock
            command={step.command}
            status={toCommandBlockStatus(status)}
            onRun={() => handleRunCommand(step.command, stepIndex)}
          />
        );

      case 'tip':
        return (
          <ContentBox variant="tip">
            {step.content}
          </ContentBox>
        );

      case 'warning':
        return (
          <ContentBox variant="warning">
            {step.content}
          </ContentBox>
        );

      case 'code-display':
        return (
          <FilePreview
            path={step.filename}
            content={step.code}
            language={getLanguageFromPath(step.filename)}
            status="created" // Display only, no action
          />
        );

      case 'choice':
        return (
          <div className="tutorial-choice">
            {step.options.map((option) => (
              <button
                key={option.value}
                className={`tutorial-choice-option ${selectedChoice === option.value ? 'selected' : ''}`}
                onClick={() => handleChoiceSelect(option.value)}
              >
                <span className="tutorial-choice-label">{option.label}</span>
                {option.description && (
                  <span className="tutorial-choice-description">{option.description}</span>
                )}
              </button>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`tutorial-panel ${externalHeader ? 'tutorial-panel-no-header' : ''}`}>
      {!externalHeader && (
        <div className="tutorial-panel-header">
          <div className="tutorial-panel-title">
            <span className="tutorial-panel-brand">pok learn</span>
            <span className="tutorial-panel-section">{currentSection.title}</span>
          </div>
          <ProgressIndicator
            current={progress.completed}
            total={progress.total}
            label={`${progress.percentage}% complete`}
          />
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="tutorial-panel-error">
          <span className="tutorial-panel-error-message">{error}</span>
          {onClearError && (
            <button
              className="tutorial-panel-error-dismiss"
              onClick={onClearError}
              aria-label="Dismiss error"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="tutorial-panel-loading">
          <div className="tutorial-panel-loading-spinner" />
          <span className="tutorial-panel-loading-text">Working...</span>
        </div>
      )}

      <div className="tutorial-panel-content">
        {currentSection.steps
          .filter((_, stepIndex) => stepIndex <= currentStepIndex)
          .map((step, filteredIndex) => {
            // filteredIndex matches stepIndex since we filter from start
            const stepIndex = filteredIndex;
            const status = getStepStatus(currentSectionIndex, stepIndex);
            const isActive = status === 'active';

            return (
              <div
                key={stepIndex}
                ref={isActive ? activeStepRef : null}
                className="tutorial-panel-step"
              >
                <TutorialStep
                  number={stepIndex + 1}
                  title={getStepTitle(step)}
                  status={toTutorialStepStatus(status)}
                >
                  {renderStepContent(step, stepIndex, status)}
                </TutorialStep>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// Helper to detect language from file path
function getLanguageFromPath(path: string): string | undefined {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    default:
      return undefined;
  }
}
