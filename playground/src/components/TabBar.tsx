import { Tab } from '../hooks/useWorkspace';

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onTabClick: (id: string) => void;
  onTabClose: (id: string) => void;
}

export function TabBar({ tabs, activeTabId, onTabClick, onTabClose }: TabBarProps) {
  return (
    <div className="tab-bar">
      <div className="tab-bar-tabs">
        {tabs.map((tab) => {
          // Use dynamic title if available, otherwise fall back to static label
          const displayLabel = tab.dynamicTitle || tab.label;
          
          return (
            <div
              key={tab.id}
              className={`tab-bar-tab ${activeTabId === tab.id ? 'tab-bar-tab-active' : ''}`}
              onClick={() => onTabClick(tab.id)}
            >
              <TabIcon type={tab.type} taskStatus={tab.taskStatus} />
              <span className="tab-bar-tab-label">{displayLabel}</span>
              {tab.closeable && (
                <button
                  className="tab-bar-tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(tab.id);
                  }}
                  aria-label={`Close ${displayLabel}`}
                >
                  <CloseIcon />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabIcon({ type, taskStatus }: { type: 'terminal' | 'file'; taskStatus?: string }) {
  // Show checkmark for completed tasks
  if (type === 'terminal' && taskStatus === 'completed') {
    return (
      <svg
        className="tab-bar-tab-icon tab-bar-tab-icon-success"
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <polyline points="3 8 6 11 13 4" />
      </svg>
    );
  }

  // Show X for failed tasks
  if (type === 'terminal' && taskStatus === 'failed') {
    return (
      <svg
        className="tab-bar-tab-icon tab-bar-tab-icon-error"
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <line x1="4" y1="4" x2="12" y2="12" />
        <line x1="12" y1="4" x2="4" y2="12" />
      </svg>
    );
  }

  if (type === 'terminal') {
    return (
      <svg
        className="tab-bar-tab-icon"
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
      className="tab-bar-tab-icon"
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

function CloseIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </svg>
  );
}
