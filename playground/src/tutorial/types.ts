/**
 * Tutorial Data Model Types
 *
 * These types define the structure for the interactive pok tutorial.
 * The tutorial is organized into sections containing steps of various types.
 */

/**
 * Information step - displays explanatory content to the user
 */
export type InfoStep = {
  type: 'info';
  title: string;
  content: string;
};

/**
 * File creation step - creates a file and shows its content
 */
export type FileCreateStep = {
  type: 'file-create';
  path: string;
  content: string;
  description: string;
};

/**
 * Command run step - executes a command and optionally validates output
 */
export type CommandRunStep = {
  type: 'command-run';
  command: string;
  description: string;
  expectedOutput?: string;
};

/**
 * Tip step - displays helpful tips or hints
 */
export type TipStep = {
  type: 'tip';
  content: string;
};

/**
 * Warning step - displays important warnings
 */
export type WarningStep = {
  type: 'warning';
  content: string;
};

/**
 * Code display step - shows code without creating a file
 */
export type CodeDisplayStep = {
  type: 'code-display';
  filename: string;
  code: string;
  description?: string;
};

/**
 * Choice step - presents options for user to select
 */
export type ChoiceStep = {
  type: 'choice';
  message: string;
  options: Array<{
    value: string;
    label: string;
    description?: string;
  }>;
};

/**
 * Union type for all tutorial step types
 */
export type TutorialStep =
  | InfoStep
  | FileCreateStep
  | CommandRunStep
  | TipStep
  | WarningStep
  | CodeDisplayStep
  | ChoiceStep;

/**
 * A section of the tutorial containing related steps
 */
export type TutorialSection = {
  id: string;
  title: string;
  stepNumber: number;
  totalSteps: number;
  steps: TutorialStep[];
};

/**
 * The complete tutorial structure
 */
export type Tutorial = {
  id: string;
  title: string;
  description: string;
  sections: TutorialSection[];
};

/**
 * Tutorial engine state
 */
export type TutorialState = {
  currentSectionIndex: number;
  currentStepIndex: number;
  completedSteps: Set<string>;
  selectedChoice: string | null;
};

/**
 * Progress information derived from state
 */
export type TutorialProgress = {
  completed: number;
  total: number;
  percentage: number;
};

/**
 * Creates a unique step ID from section and step indices
 */
export function stepId(sectionIndex: number, stepIndex: number): string {
  return `${sectionIndex}-${stepIndex}`;
}
