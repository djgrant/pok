import { useState, useEffect } from 'react';
import { WebContainer } from '@webcontainer/api';

type WebContainerStatus = 'booting' | 'installing' | 'ready' | 'error';

interface UseWebContainerResult {
  webContainer: WebContainer | null;
  status: WebContainerStatus;
  error: Error | null;
}

// Singleton pattern to ensure only one WebContainer instance
let webContainerInstance: WebContainer | null = null;
let webContainerPromise: Promise<WebContainer> | null = null;

async function getWebContainer(): Promise<WebContainer> {
  if (webContainerInstance) {
    return webContainerInstance;
  }

  if (webContainerPromise) {
    return webContainerPromise;
  }

  webContainerPromise = WebContainer.boot();
  webContainerInstance = await webContainerPromise;
  return webContainerInstance;
}

export function useWebContainer(): UseWebContainerResult {
  const [webContainer, setWebContainer] = useState<WebContainer | null>(null);
  const [status, setStatus] = useState<WebContainerStatus>('booting');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function initializeWebContainer() {
      try {
        // Boot WebContainer
        setStatus('booting');
        const container = await getWebContainer();

        if (isCancelled) return;

        // Mount files for pok
        setStatus('installing');

        await container.mount({
          'package.json': {
            file: {
              contents: JSON.stringify(
                {
                  name: 'pok-playground',
                  type: 'module',
                  dependencies: {
                    '@openpok/core': 'latest',
                  },
                },
                null,
                2
              ),
            },
          },
        });

        if (isCancelled) return;

        // Install dependencies
        const installProcess = await container.spawn('npm', ['install']);

        // Stream install output for debugging
        installProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              console.log('[npm install]:', data);
            },
          })
        );

        const installExitCode = await installProcess.exit;

        if (isCancelled) return;

        if (installExitCode !== 0) {
          throw new Error(`npm install failed with exit code ${installExitCode}`);
        }

        setWebContainer(container);
        setStatus('ready');
      } catch (err) {
        if (isCancelled) return;
        console.error('WebContainer initialization failed:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus('error');
      }
    }

    initializeWebContainer();

    return () => {
      isCancelled = true;
    };
  }, []);

  return { webContainer, status, error };
}
