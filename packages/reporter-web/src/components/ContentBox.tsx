/**
 * ContentBox - A headless container component for info/tip/warning content.
 *
 * CSS Variables Contract:
 * - --tutorial-bg: Default background color
 * - --tutorial-text: Primary text color
 * - --tutorial-text-muted: Secondary/muted text color
 * - --tutorial-border: Border color
 *
 * Data Attributes:
 * - [data-variant="info|tip|warning"]: Content variant for styling
 */

export type ContentBoxVariant = 'info' | 'tip' | 'warning';

export type ContentBoxProps = {
  /** Visual variant of the content box */
  variant: ContentBoxVariant;
  /** Optional title for the content box */
  title?: string;
  /** Content to display inside the box */
  children: React.ReactNode;
};

export function ContentBox({ variant, title, children }: ContentBoxProps) {
  return (
    <div className="content-box" data-variant={variant}>
      {title && <div className="content-box-title">{title}</div>}
      <div className="content-box-content">{children}</div>
    </div>
  );
}
