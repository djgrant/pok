import { WebContainer } from '@webcontainer/api';
import { Tab } from '../hooks/useWorkspace';
import { UseEventBusResult } from '../hooks/useEventBus';
import { FileTree } from './FileTree';

interface SidebarProps {
  tabs: Tab[];
  activeTabId: string;
  collapsed: boolean;
  expandedFolders: Set<string>;
  webcontainer: WebContainer | null;
  eventBus?: UseEventBusResult;
  onTabClick: (id: string) => void;
  onToggle: () => void;
  onToggleFolder: (path: string) => void;
  onFileClick: (filePath: string) => void;
  /** Whether sidebar is open on mobile (overlay mode) */
  mobileOpen?: boolean;
}

export function Sidebar({
  tabs,
  activeTabId,
  collapsed,
  expandedFolders,
  webcontainer,
  eventBus,
  onTabClick,
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

      <div className="sidebar-section">
        <div className="sidebar-section-header">TABS</div>
        <div className="sidebar-section-content">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`sidebar-tab ${activeTabId === tab.id ? 'sidebar-tab-active' : ''}`}
              onClick={() => onTabClick(tab.id)}
            >
              <TabIcon type={tab.type} />
              <span className="sidebar-tab-label">{tab.label}</span>
            </button>
          ))}
        </div>
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

function TabIcon({ type }: { type: 'terminal' | 'file' }) {
  if (type === 'terminal') {
    return (
      <svg
        className="sidebar-tab-icon"
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <polyline points="4 6 7 9 4 12" />
        <line x1="9" y1="12" x2="12" y2="12" />
      </svg>
    );
  }

  return (
    <svg
      className="sidebar-tab-icon"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M9 1H3v14h10V5L9 1z" />
      <polyline points="9 1 9 5 13 5" />
    </svg>
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
