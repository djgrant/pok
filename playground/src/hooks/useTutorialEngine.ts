/**
 * useTutorialEngine - React wrapper around the tutorial engine
 *
 * Provides reactive state management for the tutorial engine,
 * exposing current section, step, progress, and actions.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type {
  TutorialState,
  TutorialSection,
  TutorialStep,
  TutorialProgress,
  Tutorial,
} from '../tutorial';
import {
  createTutorialEngine,
  pokTutorial,
  stepId,
} from '../tutorial';

export type StepStatus = 'pending' | 'active' | 'complete';

export type UseTutorialEngineResult = {
  /** The tutorial being run */
  tutorial: Tutorial;
  /** Current section of the tutorial */
  currentSection: TutorialSection;
  /** Current step within the section */
  currentStep: TutorialStep;
  /** Current section index */
  currentSectionIndex: number;
  /** Current step index within the section */
  currentStepIndex: number;
  /** Overall progress */
  progress: TutorialProgress;
  /** Whether we're at the first step */
  isAtStart: boolean;
  /** Whether we're at the last step of the tutorial */
  isAtEnd: boolean;
  /** Whether we're at the last step of the current section */
  isAtSectionEnd: boolean;
  /** Current choice selection (for choice steps) */
  selectedChoice: string | null;
  /** Get the status of a step */
  getStepStatus: (sectionIndex: number, stepIndex: number) => StepStatus;
  /** Check if a step is completed */
  isStepCompleted: (sectionIndex: number, stepIndex: number) => boolean;
  /** Mark the current step as completed */
  completeStep: () => void;
  /** Move to the next step (within section only, returns false at section end) */
  nextStep: () => boolean;
  /** Move to the next section */
  nextSection: () => boolean;
  /** Move to the previous step */
  previousStep: () => boolean;
  /** Go to a specific section by ID */
  goToSection: (sectionId: string) => boolean;
  /** Set the selected choice for the current choice step */
  selectChoice: (value: string) => void;
  /** Reset the tutorial */
  reset: () => void;
  /** Complete step (for interactive steps like file-create, command-run) */
  completeStepAndProgress: () => void;
};

export function useTutorialEngine(): UseTutorialEngineResult {
  // Create engine once
  const engineRef = useRef(createTutorialEngine(pokTutorial));
  const engine = engineRef.current;

  // Track engine state reactively
  const [state, setState] = useState<TutorialState>(engine.getState);

  // Subscribe to engine changes
  useEffect(() => {
    return engine.subscribe(setState);
  }, [engine]);

  // Get step status
  const getStepStatus = useCallback(
    (sectionIndex: number, stepIndex: number): StepStatus => {
      const id = stepId(sectionIndex, stepIndex);

      // Check if completed
      if (state.completedSteps.has(id)) {
        return 'complete';
      }

      // Check if current
      if (
        sectionIndex === state.currentSectionIndex &&
        stepIndex === state.currentStepIndex
      ) {
        return 'active';
      }

      return 'pending';
    },
    [state.completedSteps, state.currentSectionIndex, state.currentStepIndex]
  );

  // Complete step only (for interactive steps - no auto-progress)
  const completeStepAndProgress = useCallback(() => {
    engine.completeStep();
    // No auto-progress - user must click Next
  }, [engine]);

  return useMemo(
    () => ({
      tutorial: engine.getTutorial(),
      currentSection: engine.getCurrentSection(),
      currentStep: engine.getCurrentStep(),
      currentSectionIndex: state.currentSectionIndex,
      currentStepIndex: state.currentStepIndex,
      progress: engine.getProgress(),
      isAtStart: engine.isAtStart(),
      isAtEnd: engine.isAtEnd(),
      isAtSectionEnd: engine.isAtSectionEnd(),
      selectedChoice: state.selectedChoice,
      getStepStatus,
      isStepCompleted: engine.isStepCompleted,
      completeStep: engine.completeStep,
      nextStep: engine.nextStep,
      nextSection: engine.nextSection,
      previousStep: engine.previousStep,
      goToSection: engine.goToSection,
      selectChoice: engine.selectChoice,
      reset: engine.reset,
      completeStepAndProgress,
    }),
    [
      engine,
      state.currentSectionIndex,
      state.currentStepIndex,
      state.completedSteps,
      state.selectedChoice,
      getStepStatus,
      completeStepAndProgress,
    ]
  );
}
