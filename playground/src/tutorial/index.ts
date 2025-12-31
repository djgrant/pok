/**
 * Tutorial Module
 *
 * Exports the tutorial data model, content, and engine for the pok playground.
 */

// Types
export type {
  TutorialStep,
  TutorialSection,
  Tutorial,
  TutorialState,
  TutorialProgress,
  InfoStep,
  FileCreateStep,
  CommandRunStep,
  TipStep,
  WarningStep,
  CodeDisplayStep,
  ChoiceStep,
} from './types';
export { stepId } from './types';

// Content
export {
  pokTutorial,
  getSectionById,
  getSectionIndexById,
  HELLO_CODE,
  GREET_CODE,
  DEV_CODE,
  TASK_CODE,
} from './content';

// Engine
export type { TutorialEngine } from './engine';
export {
  createTutorialEngine,
  createInitialState,
} from './engine';
