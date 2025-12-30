import { useState, useEffect, useCallback, useMemo } from 'react';
import { WebContainer } from '@webcontainer/api';
import { UseEventBusResult, PlaygroundEvent } from '../hooks/useEventBus';

interface FileTreeProps {
  webcontainer: WebContainer | null;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onFileClick: (filePath: string) => void;
  eventBus?: UseEventBusResult;
}

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

// Folders to exclude from the tree
const EXCLUDED_FOLDERS = new Set(['node_modules', '.git', 'dist', '.pok']);

export function FileTree({
  webcontainer,
  expandedFolders,
  onToggleFolder,
  onFileClick,
  eventBus,
}: FileTreeProps) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Read directory recursively
  const readDirectory = useCallback(
    async (dirPath: string): Promise<FileNode[]> => {
      if (!webcontainer) return [];

      try {
        const entries = await webcontainer.fs.readdir(dirPath, { withFileTypes: true });
        const nodes: FileNode[] = [];

        for (const entry of entries) {
          // Skip excluded folders
          if (EXCLUDED_FOLDERS.has(entry.name)) continue;

          const fullPath = dirPath === '.' ? entry.name : `${dirPath}/${entry.name}`;
          const isDir = entry.isDirectory();

          const node: FileNode = {
            name: entry.name,
            path: fullPath,
            isDirectory: isDir,
          };

          // Only read children for expanded directories
          if (isDir && expandedFolders.has(fullPath)) {
            node.children = await readDirectory(fullPath);
          }

          nodes.push(node);
        }

        // Sort: directories first, then alphabetically
        return nodes.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
      } catch {
        console.error(`Failed to read directory: ${dirPath}`);
        return [];
      }
    },
    [webcontainer, expandedFolders]
  );

  // Load the tree
  const loadTree = useCallback(async () => {
    if (!webcontainer) {
      setLoading(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const rootNodes = await readDirectory('.');
      setTree(rootNodes);
    } catch (err) {
      setError('Failed to load file tree');
      console.error('FileTree load error:', err);
    } finally {
      setLoading(false);
    }
  }, [webcontainer, readDirectory]);

  // Initial load and reload when expanded folders change
  useEffect(() => {
    loadTree();
  }, [loadTree]);

  // Subscribe to event bus for file changes
  useEffect(() => {
    if (!eventBus) return;

    const handleEvent = (event: PlaygroundEvent) => {
      if (
        event.type === 'tree:refresh' ||
        event.type === 'file:created' ||
        event.type === 'file:deleted'
      ) {
        loadTree();
      }
    };

    const unsubRefresh = eventBus.subscribe('tree:refresh', handleEvent);
    const unsubCreated = eventBus.subscribe('file:created', handleEvent);
    const unsubDeleted = eventBus.subscribe('file:deleted', handleEvent);

    return () => {
      unsubRefresh();
      unsubCreated();
      unsubDeleted();
    };
  }, [eventBus, loadTree]);

  if (loading && tree.length === 0) {
    return (
      <div className="file-tree-loading">
        <span className="text-muted">Loading files...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="file-tree-error">
        <span className="text-muted">{error}</span>
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="file-tree-empty">
        <span className="text-muted">No files yet</span>
      </div>
    );
  }

  return (
    <div className="file-tree">
      <FileTreeNodes
        nodes={tree}
        depth={0}
        expandedFolders={expandedFolders}
        onToggleFolder={onToggleFolder}
        onFileClick={onFileClick}
      />
    </div>
  );
}

interface FileTreeNodesProps {
  nodes: FileNode[];
  depth: number;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onFileClick: (filePath: string) => void;
}

function FileTreeNodes({
  nodes,
  depth,
  expandedFolders,
  onToggleFolder,
  onFileClick,
}: FileTreeNodesProps) {
  return (
    <>
      {nodes.map((node) => (
        <FileTreeItem
          key={node.path}
          node={node}
          depth={depth}
          expandedFolders={expandedFolders}
          onToggleFolder={onToggleFolder}
          onFileClick={onFileClick}
        />
      ))}
    </>
  );
}

interface FileTreeItemProps {
  node: FileNode;
  depth: number;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onFileClick: (filePath: string) => void;
}

function FileTreeItem({
  node,
  depth,
  expandedFolders,
  onToggleFolder,
  onFileClick,
}: FileTreeItemProps) {
  const isExpanded = expandedFolders.has(node.path);
  const indent = depth * 12;

  const handleClick = useCallback(() => {
    if (node.isDirectory) {
      onToggleFolder(node.path);
    } else {
      onFileClick(node.path);
    }
  }, [node.isDirectory, node.path, onToggleFolder, onFileClick]);

  const icon = useMemo(() => {
    if (node.isDirectory) {
      return isExpanded ? <FolderOpenIcon /> : <FolderIcon />;
    }
    return <FileIcon extension={getExtension(node.name)} />;
  }, [node.isDirectory, node.name, isExpanded]);

  return (
    <>
      <button
        className="file-tree-item"
        onClick={handleClick}
        style={{ paddingLeft: `${8 + indent}px` }}
        title={node.path}
      >
        {node.isDirectory && (
          <span className="file-tree-chevron">{isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>
        )}
        <span className="file-tree-icon">{icon}</span>
        <span className="file-tree-name">{node.name}</span>
      </button>
      {node.isDirectory && isExpanded && node.children && (
        <FileTreeNodes
          nodes={node.children}
          depth={depth + 1}
          expandedFolders={expandedFolders}
          onToggleFolder={onToggleFolder}
          onFileClick={onFileClick}
        />
      )}
    </>
  );
}

function getExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

// Icons
function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="icon-folder">
      <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.172a1.5 1.5 0 0 1 1.06.44l.829.828a.5.5 0 0 0 .353.147H13.5A1.5 1.5 0 0 1 15 4.915v7.585A1.5 1.5 0 0 1 13.5 14h-11A1.5 1.5 0 0 1 1 12.5v-9z" />
    </svg>
  );
}

function FolderOpenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="icon-folder-open">
      <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.172a1.5 1.5 0 0 1 1.06.44l.829.828a.5.5 0 0 0 .353.147H13.5A1.5 1.5 0 0 1 15 4.915V5H2.5A1.5 1.5 0 0 0 1 6.5v-3z" />
      <path d="M1.5 6h12.585a1.5 1.5 0 0 1 1.476 1.233l.914 5.022A1.5 1.5 0 0 1 15 14H2.5A1.5 1.5 0 0 1 1 12.5v-6z" />
    </svg>
  );
}

interface FileIconProps {
  extension: string;
}

function FileIcon({ extension }: FileIconProps) {
  // Color based on file extension
  const color = getFileColor(extension);

  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.2">
      <path d="M9 1H3v14h10V5L9 1z" fill="none" />
      <polyline points="9 1 9 5 13 5" fill="none" />
    </svg>
  );
}

function getFileColor(extension: string): string {
  const colors: Record<string, string> = {
    ts: '#3178c6',
    tsx: '#3178c6',
    js: '#f7df1e',
    jsx: '#f7df1e',
    json: '#cbcb41',
    md: '#519aba',
    css: '#563d7c',
    html: '#e34c26',
    yml: '#cb171e',
    yaml: '#cb171e',
  };
  return colors[extension] || 'currentColor';
}

function ChevronRightIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 4 10 8 6 12" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="4 6 8 10 12 6" />
    </svg>
  );
}
