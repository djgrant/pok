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
  AUTO_PROGRESS_DELAY,
  AUTO_PROGRESS_DELAY_LONG,
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
  /** Whether we're at the last step */
  isAtEnd: boolean;
  /** Current choice selection (for choice steps) */
  selectedChoice: string | null;
  /** Get the status of a step */
  getStepStatus: (sectionIndex: number, stepIndex: number) => StepStatus;
  /** Check if a step is completed */
  isStepCompleted: (sectionIndex: number, stepIndex: number) => boolean;
  /** Mark the current step as completed */
  completeStep: () => void;
  /** Move to the next step */
  nextStep: () => boolean;
  /** Move to the previous step */
  previousStep: () => boolean;
  /** Go to a specific section by ID */
  goToSection: (sectionId: string) => boolean;
  /** Set the selected choice for the current choice step */
  selectChoice: (value: string) => void;
  /** Reset the tutorial */
  reset: () => void;
  /** Complete step and auto-progress after delay */
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

  // Auto-progress timeout ref
  const autoProgressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoProgressTimeoutRef.current) {
        clearTimeout(autoProgressTimeoutRef.current);
      }
    };
  }, []);

  // Auto-complete non-interactive steps (info, tip, warning, code-display)
  // These steps don't require user action, so we complete and progress automatically
  useEffect(() => {
    const currentStep = engine.getCurrentStep();
    const isNonInteractiveStep =
      currentStep.type === 'info' ||
      currentStep.type === 'tip' ||
      currentStep.type === 'warning' ||
      currentStep.type === 'code-display';

    // Use longer delay for content-heavy steps that users need to read
    const isContentHeavy = currentStep.type === 'info' || currentStep.type === 'tip';
    const progressDelay = isContentHeavy ? AUTO_PROGRESS_DELAY_LONG : AUTO_PROGRESS_DELAY;

    if (isNonInteractiveStep && !engine.isCurrentStepCompleted()) {
      // Complete and progress after a short delay to allow rendering
      const timeoutId = setTimeout(() => {
        engine.completeStep();
        // Schedule progression after the step is marked complete
        // Use longer delay for info/tip steps so users can read the content
        setTimeout(() => {
          if (engine.canProgress()) {
            engine.nextStep();
          }
        }, progressDelay);
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [engine, state.currentSectionIndex, state.currentStepIndex]);

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

  // Complete step and auto-progress
  const completeStepAndProgress = useCallback(() => {
    engine.completeStep();

    // Clear any existing timeout
    if (autoProgressTimeoutRef.current) {
      clearTimeout(autoProgressTimeoutRef.current);
    }

    // Schedule auto-progress
    autoProgressTimeoutRef.current = setTimeout(() => {
      if (engine.canProgress()) {
        engine.nextStep();
      }
      autoProgressTimeoutRef.current = null;
    }, AUTO_PROGRESS_DELAY);
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
      selectedChoice: state.selectedChoice,
      getStepStatus,
      isStepCompleted: engine.isStepCompleted,
      completeStep: engine.completeStep,
      nextStep: engine.nextStep,
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
      state.selectedChoice,
      getStepStatus,
      completeStepAndProgress,
    ]
  );
}
