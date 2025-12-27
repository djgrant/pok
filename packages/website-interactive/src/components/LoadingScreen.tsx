interface LoadingScreenProps {
  status: 'booting' | 'installing';
}

export function LoadingScreen({ status }: LoadingScreenProps) {
  const statusMessages = {
    booting: 'Starting Node.js environment...',
    installing: 'Installing pok dependencies...',
  };

  const tips = [
    'pok runs entirely in your browser using WebContainers',
    'No installation required - just start learning',
    'Your progress is saved locally in your browser',
  ];

  // Pick a tip based on status
  const tipIndex = status === 'booting' ? 0 : 1;

  return (
    <div className="loading-screen">
      <div className="loading-logo">
        <span className="loading-logo-text">pok</span>
      </div>
      <p className="loading-subtitle">Interactive CLI Tutorial</p>
      <div className="loading-spinner" />
      <p className="loading-status">{statusMessages[status]}</p>
      <p className="loading-tip">{tips[tipIndex]}</p>
    </div>
  );
}
