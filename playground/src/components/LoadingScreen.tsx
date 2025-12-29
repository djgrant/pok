import { useState, useEffect } from 'react';

const sillyMessages = [
  'Waking up the hamsters...',
  'Reticulating splines...',
  'Convincing electrons to cooperate...',
  'Warming up the flux capacitor...',
  'Teaching bits to behave...',
  'Negotiating with the cloud...',
  'Bribing the servers...',
  'Summoning the code spirits...',
  'Herding digital cats...',
  'Untangling the spaghetti...',
  'Polishing the pixels...',
  'Consulting the oracle...',
];

interface LoadingScreenProps {
  status: 'booting' | 'installing';
}

export function LoadingScreen({ status: _status }: LoadingScreenProps) {
  const [messageIndex, setMessageIndex] = useState(() =>
    Math.floor(Math.random() * sillyMessages.length)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % sillyMessages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="loading-screen">
      <span className="loading-wordmark">pok</span>
      <div className="loading-dots">
        <span />
        <span />
        <span />
      </div>
      <p className="loading-status">{sillyMessages[messageIndex]}</p>
    </div>
  );
}
