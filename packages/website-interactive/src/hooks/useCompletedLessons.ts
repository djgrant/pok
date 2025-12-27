import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'pok-completed-lessons';

/**
 * Hook for managing lesson completion state with localStorage persistence
 */
export function useCompletedLessons() {
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(
    () => new Set()
  );

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCompletedLessons(new Set(parsed));
        }
      }
    } catch (error) {
      console.error('Failed to load completed lessons:', error);
    }
  }, []);

  // Save to localStorage whenever completedLessons changes
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(Array.from(completedLessons))
      );
    } catch (error) {
      console.error('Failed to save completed lessons:', error);
    }
  }, [completedLessons]);

  const markComplete = useCallback((lessonId: string) => {
    setCompletedLessons((prev) => {
      const next = new Set(prev);
      next.add(lessonId);
      return next;
    });
  }, []);

  const markIncomplete = useCallback((lessonId: string) => {
    setCompletedLessons((prev) => {
      const next = new Set(prev);
      next.delete(lessonId);
      return next;
    });
  }, []);

  const toggleComplete = useCallback((lessonId: string) => {
    setCompletedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) {
        next.delete(lessonId);
      } else {
        next.add(lessonId);
      }
      return next;
    });
  }, []);

  const isComplete = useCallback(
    (lessonId: string) => {
      return completedLessons.has(lessonId);
    },
    [completedLessons]
  );

  return {
    completedLessons,
    markComplete,
    markIncomplete,
    toggleComplete,
    isComplete,
  };
}
