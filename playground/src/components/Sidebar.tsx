import { WebContainer } from '@webcontainer/api';
import { UseEventBusResult } from '../hooks/useEventBus';
import { FileTree } from './FileTree';

interface SidebarProps {
  collapsed: boolean;
  expandedFolders: Set<string>;
  webcontainer: WebContainer | null;
  eventBus?: UseEventBusResult;
  onToggle: () => void;
  onToggleFolder: (path: string) => void;
  onFileClick: (filePath: string) => void;
  /** Whether sidebar is open on mobile (overlay mode) */
  mobileOpen?: boolean;
}

export function Sidebar({
  collapsed,
  expandedFolders,
  webcontainer,
  eventBus,
  onToggle,
  onToggleFolder,
  onFileClick,
  mobileOpen = false,
}: SidebarProps) {
  // Build class names for sidebar
  const sidebarClasses = [
    'sidebar',
    collapsed && !mobileOpen ? 'sidebar-collapsed' : '',
    mobileOpen ? 'sidebar-mobile-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (collapsed && !mobileOpen) {
    return (
      <div className={sidebarClasses}>
        <button
          className="sidebar-toggle"
          onClick={onToggle}
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          <ChevronRightIcon />
        </button>
      </div>
    );
  }

  return (
    <div className={sidebarClasses}>
      <div className="sidebar-header">
        <span className="sidebar-title">EXPLORER</span>
        <button
          className="sidebar-toggle"
          onClick={onToggle}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <ChevronLeftIcon />
        </button>
      </div>

      <div className="sidebar-section sidebar-section-files">
        <div className="sidebar-section-header">FILES</div>
        <div className="sidebar-section-content">
          <FileTree
            webcontainer={webcontainer}
            expandedFolders={expandedFolders}
            onToggleFolder={onToggleFolder}
            onFileClick={onFileClick}
            eventBus={eventBus}
          />
        </div>
      </div>
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <polyline points="10 4 6 8 10 12" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <polyline points="6 4 10 8 6 12" />
    </svg>
  );
}
