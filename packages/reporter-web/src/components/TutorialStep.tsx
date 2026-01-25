/**
 * TutorialStep - A headless component for rendering tutorial step containers.
 *
 * CSS Variables Contract:
 * - --tutorial-step-active: Background/border color for active step
 * - --tutorial-step-complete: Background/border color for complete step
 * - --tutorial-step-pending: Background/border color for pending step
 * - --tutorial-bg: Default background color
 * - --tutorial-text: Primary text color
 * - --tutorial-text-muted: Secondary/muted text color
 * - --tutorial-border: Border color
 *
 * Data Attributes:
 * - [data-status="pending|active|complete"]: Step status for styling
 */

export type TutorialStepStatus = 'pending' | 'active' | 'complete';

export type TutorialStepProps = {
  /** Step number displayed in the header */
  number: number;
  /** Step title */
  title: string;
  /** Current status of the step */
  status: TutorialStepStatus;
  /** Step content */
  children: React.ReactNode;
};

export function TutorialStep({ number, title, status, children }: TutorialStepProps) {
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
