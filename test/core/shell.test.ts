import { describe, it, expect, afterEach } from 'bun:test';
import {
  commandExists,
  getVersion,
  getNodeMajorVersion,
  shellRun,
  shellRunQuiet,
  getPackageManager,
} from '@openpok/core';

// =============================================================================
// commandExists Tests
// =============================================================================

describe('commandExists', () => {
  it('returns true for existing command (node)', async () => {
    const exists = await commandExists('node');
    expect(exists).toBe(true);
  });

  it('returns true for existing command (bun)', async () => {
    const exists = await commandExists('bun');
    expect(exists).toBe(true);
  });

  it('returns false for non-existent command', async () => {
    const exists = await commandExists('nonexistent-command-xyz-12345');
    expect(exists).toBe(false);
  });
});

// =============================================================================
// getVersion Tests
// =============================================================================

describe('getVersion', () => {
  it('returns version string for node', async () => {
    const version = await getVersion('node');
    expect(version).not.toBeNull();
    expect(version).toMatch(/v?\d+\.\d+\.\d+/);
  });

  it('returns version string for bun', async () => {
    const version = await getVersion('bun');
    expect(version).not.toBeNull();
    expect(version).toMatch(/\d+\.\d+\.\d+/);
  });

  it('returns null for non-existent command', async () => {
    const version = await getVersion('nonexistent-command-xyz-12345');
    expect(version).toBeNull();
  });
});

// =============================================================================
// getNodeMajorVersion Tests
// =============================================================================

describe('getNodeMajorVersion', () => {
  it('returns a positive integer', async () => {
    const majorVersion = await getNodeMajorVersion();
    expect(majorVersion).not.toBeNull();
    expect(majorVersion).toBeGreaterThan(0);
  });

  it('returns a reasonable Node version (14+)', async () => {
    const majorVersion = await getNodeMajorVersion();
    expect(majorVersion).toBeGreaterThanOrEqual(14);
  });
});

// =============================================================================
// shellRun Tests
// =============================================================================

describe('shellRun', () => {
  it('returns exitCode 0 for successful command', async () => {
    const result = await shellRun('echo', ['hello']);
    expect(result.exitCode).toBe(0);
  });

  it('returns non-zero exitCode for failing command', async () => {
    const result = await shellRun('false', []);
    expect(result.exitCode).not.toBe(0);
  });

  it('handles command with arguments', async () => {
    const result = await shellRun('node', ['--version']);
    expect(result.exitCode).toBe(0);
  });
});

// =============================================================================
// shellRunQuiet Tests
// =============================================================================

describe('shellRunQuiet', () => {
  it('returns true for successful command', async () => {
    const success = await shellRunQuiet('echo', ['hello']);
    expect(success).toBe(true);
  });

  it('returns false for failing command', async () => {
    const success = await shellRunQuiet('false', []);
    expect(success).toBe(false);
  });

  it('returns false for non-existent command', async () => {
    const success = await shellRunQuiet('nonexistent-command-xyz-12345', []);
    expect(success).toBe(false);
  });
});

// =============================================================================
// getPackageManager Tests
// =============================================================================

describe('getPackageManager', () => {
  const originalUserAgent = process.env.npm_config_user_agent;

  afterEach(() => {
    // Restore original user agent
    if (originalUserAgent !== undefined) {
      process.env.npm_config_user_agent = originalUserAgent;
    } else {
      delete process.env.npm_config_user_agent;
    }
  });

  it('detects pnpm from user agent', () => {
    process.env.npm_config_user_agent = 'pnpm/8.6.0 npm/? node/v20.0.0';
    expect(getPackageManager()).toBe('pnpm');
  });

  it('detects yarn from user agent', () => {
    process.env.npm_config_user_agent = 'yarn/1.22.19 npm/? node/v20.0.0';
    expect(getPackageManager()).toBe('yarn');
  });

  it('detects npm from user agent', () => {
    process.env.npm_config_user_agent = 'npm/9.6.7 node/v20.0.0';
    expect(getPackageManager()).toBe('npm');
  });

  it('detects bun from user agent', () => {
    process.env.npm_config_user_agent = 'bun/1.0.0 npm/? node/v20.0.0';
    expect(getPackageManager()).toBe('bun');
  });

  it('falls back to npm when no user agent', () => {
    delete process.env.npm_config_user_agent;
    expect(getPackageManager()).toBe('npm');
  });

  it('falls back to npm for unknown user agent', () => {
    process.env.npm_config_user_agent = 'unknown/1.0.0';
    expect(getPackageManager()).toBe('npm');
  });
});
