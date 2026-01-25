/**
 * Tutorial Renderer Components
 *
 * Headless React components for rendering tutorial content.
 * All components use CSS variables and data attributes for styling,
 * allowing full customization by the consuming application.
 *
 * CSS Variables Contract:
 * --tutorial-bg              Default background color
 * --tutorial-step-active     Background/border for active step
 * --tutorial-step-complete   Background/border for complete step
 * --tutorial-step-pending    Background/border for pending step
 * --tutorial-code-bg         Background for code/command blocks
 * --tutorial-action-bg       Action button background
 * --tutorial-action-hover    Action button hover background
 * --tutorial-border          Border color
 * --tutorial-text            Primary text color
 * --tutorial-text-muted      Secondary/muted text color
 */

// TutorialStep
export { TutorialStep } from './TutorialStep';
export type { TutorialStepProps, TutorialStepStatus } from './TutorialStep';

// FilePreview
export { FilePreview } from './FilePreview';
export type { FilePreviewProps, FilePreviewStatus, FilePreviewActionProps } from './FilePreview';

// CommandBlock
export { CommandBlock } from './CommandBlock';
export type {
  CommandBlockProps,
  CommandBlockStatus,
  CommandBlockActionProps,
} from './CommandBlock';

// ProgressIndicator
export { ProgressIndicator } from './ProgressIndicator';
export type { ProgressIndicatorProps } from './ProgressIndicator';

// ContentBox
export { ContentBox } from './ContentBox';
export type { ContentBoxProps, ContentBoxVariant } from './ContentBox';
