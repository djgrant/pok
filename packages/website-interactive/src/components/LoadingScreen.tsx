interface LoadingScreenProps {
  status: 'booting' | 'installing';
}

export function LoadingScreen({ status }: LoadingScreenProps) {
  const statusMessages = {
    booting: 'Starting Node.js environment...',
    installing: 'Installing pok dependencies...',
  };

  return (
    <div className="loading-screen">
      <h1>pok</h1>
      <p>Loading interactive terminal</p>
      <div className="loading-spinner" />
      <p className="loading-status">{statusMessages[status]}</p>
    </div>
  );
}
