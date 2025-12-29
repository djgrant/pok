interface LoadingScreenProps {
  status: 'booting' | 'installing';
}

export function LoadingScreen({ status }: LoadingScreenProps) {
  const statusMessages = {
    booting: 'Starting environment...',
    installing: 'Installing dependencies...',
  };

  return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <p className="loading-status">{statusMessages[status]}</p>
    </div>
  );
}
