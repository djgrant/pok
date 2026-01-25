/**
 * FilePreview - A headless component for displaying file content with action slot.
 *
 * CSS Variables Contract:
 * - --tutorial-code-bg: Background color for code/file content area
 * - --tutorial-bg: Default background color
 * - --tutorial-text: Primary text color
 * - --tutorial-text-muted: Secondary/muted text color
 * - --tutorial-border: Border color
 * - --tutorial-action-bg: Action button background
 * - --tutorial-action-hover: Action button hover background
 *
 * Data Attributes:
 * - [data-status="pending|creating|created"]: File status for styling
 * - [data-language="..."]: Language hint for syntax highlighting
 */

export type FilePreviewStatus = 'pending' | 'creating' | 'created';

export type FilePreviewActionProps = {
  onClick: () => void;
  status: FilePreviewStatus;
  disabled: boolean;
};

export type FilePreviewProps = {
  /** File path to display in header */
  path: string;
  /** File content to display */
  content: string;
  /** Language for syntax highlighting hint */
  language?: string;
  /** Current status of the file operation */
  status: FilePreviewStatus;
  /** Callback when action is triggered (if no renderAction provided) */
  onAction?: () => void;
  /** Render prop for custom action button */
  renderAction?: (props: FilePreviewActionProps) => React.ReactNode;
};

export function FilePreview({
  path,
  content,
  language,
  status,
  onAction,
  renderAction,
}: FilePreviewProps) {
  const disabled = status === 'creating' || status === 'created';
  const handleClick = () => {
    if (!disabled && onAction) {
      onAction();
    }
  };

  const actionProps: FilePreviewActionProps = {
    onClick: handleClick,
    status,
    disabled,
  };

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
      {(renderAction || onAction) && (
        <div className="file-preview-actions">
          {renderAction ? (
            renderAction(actionProps)
          ) : (
            <button
              className="file-preview-action-button"
              onClick={handleClick}
              disabled={disabled}
              data-status={status}
            >
              {status === 'pending' && 'Create'}
              {status === 'creating' && 'Creating...'}
              {status === 'created' && 'Created'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
