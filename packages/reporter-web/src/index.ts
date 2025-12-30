/**
 * @pokjs/reporter-web
 *
 * Web/React implementation of the ReporterAdapter interface.
 * Provides a store for state management and React hooks for subscription.
 */

// Store
export { createReporterStore } from './store';
export type { CreateReporterStoreOptions, ReporterStoreWithHandler } from './store';

// Adapter
export { createWebReporterAdapter } from './adapter';

// Hooks
export {
  useReporterState,
  useActivity,
  useGroup,
  useRootState,
  useLogs,
  useSuspended,
} from './hooks';

// Types
export type {
  RootStatus,
  ActivityStatus,
  TemporalMarkers,
  ActivityState,
  GroupState,
  LogEntry,
  RootState,
  ReporterState,
  StateListener,
  ReporterStore,
} from './types';

// Components
export {
  TutorialStep,
  FilePreview,
  CommandBlock,
  ProgressIndicator,
  ContentBox,
} from './components';
export type {
  TutorialStepProps,
  TutorialStepStatus,
  FilePreviewProps,
  FilePreviewStatus,
  FilePreviewActionProps,
  CommandBlockProps,
  CommandBlockStatus,
  CommandBlockActionProps,
  ProgressIndicatorProps,
  ContentBoxProps,
  ContentBoxVariant,
} from './components';
