/**
 * ProgressIndicator - A headless component for displaying tutorial progress.
 *
 * CSS Variables Contract:
 * - --tutorial-text: Primary text color
 * - --tutorial-text-muted: Secondary/muted text color
 *
 * Data Attributes:
 * - [data-progress]: Current progress ratio (0-1) as data attribute
 * - [data-complete="true"]: When current equals total
 */

export type ProgressIndicatorProps = {
  /** Current step number (1-indexed) */
  current: number;
  /** Total number of steps */
  total: number;
  /** Optional custom label (defaults to "Step X of Y") */
  label?: string;
};

export function ProgressIndicator({ current, total, label }: ProgressIndicatorProps) {
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
        <div className="progress-indicator-fill" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
