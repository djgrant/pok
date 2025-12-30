import { useState, useCallback, useMemo } from 'react';

export type TabType = 'terminal' | 'file';

export type TaskStatus = 'running' | 'completed' | 'failed';

export type Tab = {
  id: string;
  type: TabType;
  label: string;
  closeable: boolean;
  command?: string; // for terminal tabs
  filePath?: string; // for file tabs
  /** Dynamic title from terminal escape sequence */
  dynamicTitle?: string;
  /** Task status for terminal tabs with commands */
  taskStatus?: TaskStatus;
  /** Exit code when task completed */
  exitCode?: number;
};

export type WorkspaceState = {
  tabs: Tab[];
  activeTabId: string;
  splitTabId: string | null;
  sidebarCollapsed: boolean;
  expandedFolders: Set<string>;
};

const initialState: WorkspaceState = {
  tabs: [
    { id: 'learn', type: 'terminal', label: 'pok learn', closeable: false, command: 'pok learn' },
    { id: 'shell', type: 'terminal', label: 'shell', closeable: false },
  ],
  activeTabId: 'learn',
  splitTabId: 'shell',
  sidebarCollapsed: false,
  expandedFolders: new Set(),
};

export type WorkspaceActions = {
  setActiveTab: (id: string) => void;
  setSplitTab: (id: string | null) => void;
  toggleSidebar: () => void;
  openFileTab: (filePath: string) => void;
  closeTab: (id: string) => void;
  toggleFolder: (path: string) => void;
  updateTabTitle: (id: string, title: string) => void;
  setTaskComplete: (id: string, exitCode: number) => void;
};

export type UseWorkspaceResult = WorkspaceState & WorkspaceActions;

export function useWorkspace(): UseWorkspaceResult {
  const [state, setState] = useState<WorkspaceState>(initialState);

  const setActiveTab = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      activeTabId: id,
    }));
  }, []);

  const setSplitTab = useCallback((id: string | null) => {
    setState((prev) => ({
      ...prev,
      splitTabId: id,
    }));
  }, []);

  const toggleSidebar = useCallback(() => {
    setState((prev) => ({
      ...prev,
      sidebarCollapsed: !prev.sidebarCollapsed,
    }));
  }, []);

  const openFileTab = useCallback((filePath: string) => {
    setState((prev) => {
      // Check if tab already exists
      const existingTab = prev.tabs.find((tab) => tab.type === 'file' && tab.filePath === filePath);
      if (existingTab) {
        // Focus existing tab
        return {
          ...prev,
          activeTabId: existingTab.id,
        };
      }

      // Create new tab
      const fileName = filePath.split('/').pop() || filePath;
      const newTab: Tab = {
        id: `file-${Date.now()}`,
        type: 'file',
        label: fileName,
        closeable: true,
        filePath,
      };

      return {
        ...prev,
        tabs: [...prev.tabs, newTab],
        activeTabId: newTab.id,
      };
    });
  }, []);

  const closeTab = useCallback((id: string) => {
    setState((prev) => {
      const tab = prev.tabs.find((t) => t.id === id);
      if (!tab || !tab.closeable) {
        return prev;
      }

      const newTabs = prev.tabs.filter((t) => t.id !== id);
      let newActiveTabId = prev.activeTabId;

      // If we're closing the active tab, switch to another
      if (prev.activeTabId === id && newTabs.length > 0) {
        const closedIndex = prev.tabs.findIndex((t) => t.id === id);
        const newIndex = Math.min(closedIndex, newTabs.length - 1);
        newActiveTabId = newTabs[newIndex].id;
      }

      // Also clear split if it was the split tab
      const newSplitTabId = prev.splitTabId === id ? null : prev.splitTabId;

      return {
        ...prev,
        tabs: newTabs,
        activeTabId: newActiveTabId,
        splitTabId: newSplitTabId,
      };
    });
  }, []);

  const toggleFolder = useCallback((path: string) => {
    setState((prev) => {
      const newExpanded = new Set(prev.expandedFolders);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      return {
        ...prev,
        expandedFolders: newExpanded,
      };
    });
  }, []);

  const updateTabTitle = useCallback((id: string, title: string) => {
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((tab) =>
        tab.id === id ? { ...tab, dynamicTitle: title } : tab
      ),
    }));
  }, []);

  const setTaskComplete = useCallback((id: string, exitCode: number) => {
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((tab) =>
        tab.id === id
          ? { ...tab, taskStatus: (exitCode === 0 ? 'completed' : 'failed') as TaskStatus, exitCode }
          : tab
      ),
    }));
  }, []);

  return useMemo(
    () => ({
      ...state,
      setActiveTab,
      setSplitTab,
      toggleSidebar,
      openFileTab,
      closeTab,
      toggleFolder,
      updateTabTitle,
      setTaskComplete,
    }),
    [state, setActiveTab, setSplitTab, toggleSidebar, openFileTab, closeTab, toggleFolder, updateTabTitle, setTaskComplete]
  );
}
