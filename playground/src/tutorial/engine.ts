/**
 * Tutorial Engine
 *
 * Manages tutorial state, progression, and derived values.
 * This engine can be used by React components or other consumers
 * to control the tutorial flow.
 */

import type {
  Tutorial,
  TutorialState,
  TutorialProgress,
  TutorialStep,
  TutorialSection,
} from './types';
import { stepId } from './types';

/**
 * Create the initial state for a tutorial
 */
export function createInitialState(): TutorialState {
  return {
    currentSectionIndex: 0,
    currentStepIndex: 0,
    completedSteps: new Set(),
    selectedChoice: null,
  };
}

/**
 * Tutorial engine that manages state and provides actions
 */
export type TutorialEngine = {
  /** Get current state */
  getState: () => TutorialState;

  /** Get the tutorial being run */
  getTutorial: () => Tutorial;

  /** Get current section */
  getCurrentSection: () => TutorialSection;

  /** Get current step */
  getCurrentStep: () => TutorialStep;

  /** Check if current step is completed */
  isCurrentStepCompleted: () => boolean;

  /** Check if a specific step is completed */
  isStepCompleted: (sectionIndex: number, stepIndex: number) => boolean;

  /** Mark the current step as completed */
  completeStep: () => void;

  /** Move to the next step (within section or to next section) */
  nextStep: () => boolean;

  /** Move to the previous step */
  previousStep: () => boolean;

  /** Go to a specific section by ID */
  goToSection: (sectionId: string) => boolean;

  /** Go to a specific section by index */
  goToSectionByIndex: (index: number) => boolean;

  /** Set the selected choice for the current choice step */
  selectChoice: (value: string) => void;

  /** Get current progress */
  getProgress: () => TutorialProgress;

  /** Check if we can progress to the next step */
  canProgress: () => boolean;

  /** Check if we're at the first step of the first section */
  isAtStart: () => boolean;

  /** Check if we're at the last step of the last section */
  isAtEnd: () => boolean;

  /** Check if we're at the last step of the current section */
  isAtSectionEnd: () => boolean;

  /** Move to the next section (first step of next section) */
  nextSection: () => boolean;

  /** Reset the tutorial to the beginning */
  reset: () => void;

  /** Subscribe to state changes */
  subscribe: (listener: (state: TutorialState) => void) => () => void;
};

/**
 * Create a tutorial engine instance
 */
export function createTutorialEngine(tutorial: Tutorial): TutorialEngine {
  let state = createInitialState();
  const listeners = new Set<(state: TutorialState) => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener(state);
    }
  };

  const setState = (updates: Partial<TutorialState>) => {
    state = { ...state, ...updates };
    notify();
  };

  const getCurrentSectionStepCount = (): number => {
    return tutorial.sections[state.currentSectionIndex].steps.length;
  };

  const getCompletedInCurrentSection = (): number => {
    const sectionIndex = state.currentSectionIndex;
    const sectionSteps = tutorial.sections[sectionIndex].steps.length;
    let count = 0;
    for (let i = 0; i < sectionSteps; i++) {
      const id = `${sectionIndex}-${i}`;
      if (state.completedSteps.has(id)) {
        count++;
      }
    }
    return count;
  };

  const engine: TutorialEngine = {
    getState: () => state,

    getTutorial: () => tutorial,

    getCurrentSection: () => {
      return tutorial.sections[state.currentSectionIndex];
    },

    getCurrentStep: () => {
      const section = tutorial.sections[state.currentSectionIndex];
      return section.steps[state.currentStepIndex];
    },

    isCurrentStepCompleted: () => {
      const id = stepId(state.currentSectionIndex, state.currentStepIndex);
      return state.completedSteps.has(id);
    },

    isStepCompleted: (sectionIndex: number, stepIndex: number) => {
      const id = stepId(sectionIndex, stepIndex);
      return state.completedSteps.has(id);
    },

    completeStep: () => {
      const id = stepId(state.currentSectionIndex, state.currentStepIndex);
      if (!state.completedSteps.has(id)) {
        const newCompleted = new Set(state.completedSteps);
        newCompleted.add(id);
        setState({ completedSteps: newCompleted });
      }
    },

    nextStep: () => {
      const section = tutorial.sections[state.currentSectionIndex];

      // Try to move within current section only
      if (state.currentStepIndex < section.steps.length - 1) {
        setState({
          currentStepIndex: state.currentStepIndex + 1,
          selectedChoice: null,
        });
        return true;
      }

      // At end of section - do NOT auto-advance to next section
      return false;
    },

    nextSection: () => {
      // Move to next section if available
      if (state.currentSectionIndex < tutorial.sections.length - 1) {
        setState({
          currentSectionIndex: state.currentSectionIndex + 1,
          currentStepIndex: 0,
          selectedChoice: null,
        });
        return true;
      }

      // Already at last section
      return false;
    },

    previousStep: () => {
      // Try to move within current section
      if (state.currentStepIndex > 0) {
        setState({
          currentStepIndex: state.currentStepIndex - 1,
          selectedChoice: null,
        });
        return true;
      }

      // Try to move to previous section
      if (state.currentSectionIndex > 0) {
        const prevSection = tutorial.sections[state.currentSectionIndex - 1];
        setState({
          currentSectionIndex: state.currentSectionIndex - 1,
          currentStepIndex: prevSection.steps.length - 1,
          selectedChoice: null,
        });
        return true;
      }

      // Already at start
      return false;
    },

    goToSection: (sectionId: string) => {
      const index = tutorial.sections.findIndex((s) => s.id === sectionId);
      if (index === -1) return false;

      setState({
        currentSectionIndex: index,
        currentStepIndex: 0,
        selectedChoice: null,
      });
      return true;
    },

    goToSectionByIndex: (index: number) => {
      if (index < 0 || index >= tutorial.sections.length) return false;

      setState({
        currentSectionIndex: index,
        currentStepIndex: 0,
        selectedChoice: null,
      });
      return true;
    },

    selectChoice: (value: string) => {
      setState({ selectedChoice: value });
    },

    getProgress: () => {
      const total = getCurrentSectionStepCount();
      const completed = getCompletedInCurrentSection();
      return {
        completed,
        total,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    },

    canProgress: () => {
      const currentStep = engine.getCurrentStep();

      // For choice steps, must have a selection
      if (currentStep.type === 'choice') {
        return state.selectedChoice !== null;
      }

      // For all other steps, they must be completed
      return engine.isCurrentStepCompleted();
    },

    isAtStart: () => {
      return state.currentSectionIndex === 0 && state.currentStepIndex === 0;
    },

    isAtEnd: () => {
      const lastSectionIndex = tutorial.sections.length - 1;
      const lastSection = tutorial.sections[lastSectionIndex];
      const lastStepIndex = lastSection.steps.length - 1;

      return (
        state.currentSectionIndex === lastSectionIndex && state.currentStepIndex === lastStepIndex
      );
    },

    isAtSectionEnd: () => {
      const section = tutorial.sections[state.currentSectionIndex];
      return state.currentStepIndex === section.steps.length - 1;
    },

    reset: () => {
      state = createInitialState();
      notify();
    },

    subscribe: (listener: (state: TutorialState) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return engine;
}
