/**
 * CommandBlock - A headless component for displaying shell commands with output.
 *
 * CSS Variables Contract:
 * - --tutorial-code-bg: Background color for command/output area
 * - --tutorial-bg: Default background color
 * - --tutorial-text: Primary text color
 * - --tutorial-text-muted: Secondary/muted text color
 * - --tutorial-border: Border color
 * - --tutorial-action-bg: Action button background
 * - --tutorial-action-hover: Action button hover background
 *
 * Data Attributes:
 * - [data-status="idle|running|complete|failed"]: Command status for styling
 */

export type CommandBlockStatus = 'idle' | 'running' | 'complete' | 'failed';

export type CommandBlockActionProps = {
  onClick: () => void;
  status: CommandBlockStatus;
  disabled: boolean;
};

export type CommandBlockProps = {
  /** Command to display */
  command: string;
  /** Current status of the command execution */
  status: CommandBlockStatus;
  /** Output lines from the command */
  output?: string[];
  /** Callback when run action is triggered (if no renderAction provided) */
  onRun?: () => void;
  /** Render prop for custom action button */
  renderAction?: (props: CommandBlockActionProps) => React.ReactNode;
};

export function CommandBlock({
  command,
  status,
  output,
  onRun,
  renderAction,
}: CommandBlockProps) {
  const disabled = status === 'running';
  const handleClick = () => {
    if (!disabled && onRun) {
      onRun();
    }
  };

  const actionProps: CommandBlockActionProps = {
    onClick: handleClick,
    status,
    disabled,
  };

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
      {(renderAction || onRun) && (
        <div className="command-block-actions">
          {renderAction ? (
            renderAction(actionProps)
          ) : (
            <button
              className="command-block-action-button"
              onClick={handleClick}
              disabled={disabled}
              data-status={status}
            >
              {status === 'idle' && 'Run'}
              {status === 'running' && 'Running...'}
              {status === 'complete' && 'Run Again'}
              {status === 'failed' && 'Retry'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
