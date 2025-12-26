/**
 * Shared Tab State Management Hook
 *
 * Framework-agnostic state management for tabbed terminal interfaces.
 * Handles tab selection, scroll offsets, auto-scroll behavior, and help hint visibility.
 */

import { useState, useEffect, useCallback } from 'react';
import type { TabProcess } from '../types.js';
import { HELP_HINT_DURATION_MS } from '../constants/keyboard.js';

export type UseTabsStateOptions = {
  /** List of tab processes */
  tabs: TabProcess[];
  /** Current active tab index */
  activeIndex: number;
  /** Callback when active index changes */
  onActiveIndexChange: (index: number) => void;
  /** Height of the output view in lines */
  viewHeight: number;
};

export type TabsState = {
  /** Whether to show the help hint */
  showHelpHint: boolean;
  /** Current scroll offset for the active tab */
  activeScrollOffset: number;
  /** Whether the user can scroll up */
  canScrollUp: boolean;
  /** Whether the user can scroll down */
  canScrollDown: boolean;
};

export type TabsActions = {
  /** Scroll by a given delta (positive = down, negative = up) */
  scrollBy: (delta: number) => void;
  /** Switch to a specific tab by index */
  switchTab: (index: number) => void;
  /** Switch to the next tab (wraps around) */
  nextTab: () => void;
  /** Switch to the previous tab (wraps around) */
  prevTab: () => void;
};

/**
 * Hook for managing tabbed interface state.
 *
 * Provides:
 * - Per-tab scroll offsets with auto-scroll behavior
 * - Tab navigation helpers
 * - Help hint auto-dismiss timer
 */
export function useTabsState({
  tabs,
  activeIndex,
  onActiveIndexChange,
  viewHeight,
}: UseTabsStateOptions): TabsState & TabsActions {
  // Show help hint for first N seconds
  const [showHelpHint, setShowHelpHint] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShowHelpHint(false), HELP_HINT_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  // Per-tab scroll offsets
  const [scrollOffsets, setScrollOffsets] = useState<Map<string, number>>(() => new Map());
  // Per-tab auto-scroll state
  const [autoScroll, setAutoScroll] = useState<Map<string, boolean>>(
    () => new Map(tabs.map((t) => [t.id, true]))
  );

  const activeTab = tabs[activeIndex];
  const activeScrollOffset = scrollOffsets.get(activeTab?.id ?? '') ?? 0;

  // Calculate scroll state
  const totalLines = activeTab?.output.length ?? 0;
  const maxScroll = Math.max(0, totalLines - viewHeight);
  const canScrollUp = activeScrollOffset > 0;
  const canScrollDown = activeScrollOffset < maxScroll;

  // Auto-scroll when new output arrives (if auto-scroll enabled for this tab)
  useEffect(() => {
    if (!activeTab) return;
    const shouldAutoScroll = autoScroll.get(activeTab.id) ?? true;
    if (shouldAutoScroll) {
      const maxScroll = Math.max(0, activeTab.output.length - viewHeight);
      setScrollOffsets((prev: Map<string, number>) => {
        const next = new Map(prev);
        next.set(activeTab.id, maxScroll);
        return next;
      });
    }
  }, [activeTab, viewHeight, autoScroll]);

  const scrollBy = useCallback(
    (delta: number) => {
      if (!activeTab) return;
      const maxScroll = Math.max(0, activeTab.output.length - viewHeight);
      setScrollOffsets((prev: Map<string, number>) => {
        const next = new Map(prev);
        const current = prev.get(activeTab.id) ?? 0;
        const newOffset = Math.max(0, Math.min(maxScroll, current + delta));
        next.set(activeTab.id, newOffset);

        // If scrolled away from bottom, disable auto-scroll
        // If scrolled to bottom, re-enable auto-scroll
        const atBottom = newOffset >= maxScroll;
        setAutoScroll((as: Map<string, boolean>) => {
          const asNext = new Map(as);
          asNext.set(activeTab.id, atBottom);
          return asNext;
        });

        return next;
      });
    },
    [activeTab, viewHeight]
  );

  const switchTab = useCallback(
    (newIndex: number) => {
      if (newIndex >= 0 && newIndex < tabs.length) {
        onActiveIndexChange(newIndex);
      }
    },
    [tabs.length, onActiveIndexChange]
  );

  const nextTab = useCallback(() => {
    switchTab((activeIndex + 1) % tabs.length);
  }, [activeIndex, tabs.length, switchTab]);

  const prevTab = useCallback(() => {
    switchTab((activeIndex - 1 + tabs.length) % tabs.length);
  }, [activeIndex, tabs.length, switchTab]);

  return {
    // State
    showHelpHint,
    activeScrollOffset,
    canScrollUp,
    canScrollDown,
    // Actions
    scrollBy,
    switchTab,
    nextTab,
    prevTab,
  };
}
