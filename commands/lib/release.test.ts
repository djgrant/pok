import { describe, expect, test } from 'bun:test';
import {
  computeAheadVersion,
  computeReconcileBump,
  computeRepins,
  findBrokenInvariant,
  isPokitPackage,
  isWorkspaceLinked,
  repinSpec,
  resolvePinnedVersion,
  resolveTargetPackage,
} from './release';

describe('resolveTargetPackage', () => {
  test('resolves npm alias specs to the aliased package', () => {
    expect(resolveTargetPackage('@pokit/core', 'npm:@pokit/core@0.1.0')).toBe('@pokit/core');
    expect(resolveTargetPackage('anything', 'npm:@pokit/terminal@0.2.0')).toBe('@pokit/terminal');
    expect(resolveTargetPackage('my-alias', 'npm:pokit@0.0.38')).toBe('pokit');
  });

  test('falls back to the dep key for plain specs', () => {
    expect(resolveTargetPackage('pokit', '0.0.38')).toBe('pokit');
    expect(resolveTargetPackage('typescript', '^5.8.3')).toBe('typescript');
  });
});

describe('resolvePinnedVersion', () => {
  test('extracts exact versions from aliases and plain pins', () => {
    expect(resolvePinnedVersion('npm:@pokit/core@0.1.0')).toBe('0.1.0');
    expect(resolvePinnedVersion('0.0.38')).toBe('0.0.38');
  });

  test('returns null for ranges and non-pins', () => {
    expect(resolvePinnedVersion('^5.8.3')).toBeNull();
    expect(resolvePinnedVersion('latest')).toBeNull();
    expect(resolvePinnedVersion('npm:@pokit/core@^0.1.0')).toBeNull();
    expect(resolvePinnedVersion('workspace:*')).toBeNull();
  });
});

describe('repinSpec', () => {
  test('preserves alias form', () => {
    expect(repinSpec('npm:@pokit/core@0.1.0', '@pokit/core', '0.2.0')).toBe(
      'npm:@pokit/core@0.2.0',
    );
  });

  test('plain pins stay plain', () => {
    expect(repinSpec('0.0.38', 'pokit', '0.0.39')).toBe('0.0.39');
  });
});

describe('isPokitPackage', () => {
  test('matches the pok publish surface only', () => {
    expect(isPokitPackage('pokit')).toBe(true);
    expect(isPokitPackage('create-pokit')).toBe(true);
    expect(isPokitPackage('@pokit/core')).toBe(true);
    expect(isPokitPackage('@pokit/terminal')).toBe(true);
    expect(isPokitPackage('typescript')).toBe(false);
    expect(isPokitPackage('zod')).toBe(false);
    expect(isPokitPackage('pokit-unrelated')).toBe(false);
  });
});

describe('computeRepins', () => {
  const rootDeps = {
    '@pokit/core': 'npm:@pokit/core@0.1.0',
    '@pokit/reporter-clack': 'npm:@pokit/reporter-clack@0.1.0',
    '@pokit/prompter-clack': 'npm:@pokit/prompter-clack@0.1.0',
    pokit: '0.0.38',
    typescript: '^5.8.3',
    zod: '^4.3.6',
  };

  test('repins every root pok dep that was just published', () => {
    const published = new Map([
      ['@pokit/core', '0.2.0'],
      ['@pokit/reporter-clack', '0.2.0'],
      ['@pokit/prompter-clack', '0.2.0'],
      ['pokit', '0.0.39'],
    ]);
    const { repins, warnings } = computeRepins(rootDeps, published);
    expect(warnings).toEqual([]);
    expect(repins).toEqual([
      { key: '@pokit/core', from: 'npm:@pokit/core@0.1.0', to: 'npm:@pokit/core@0.2.0' },
      {
        key: '@pokit/reporter-clack',
        from: 'npm:@pokit/reporter-clack@0.1.0',
        to: 'npm:@pokit/reporter-clack@0.2.0',
      },
      {
        key: '@pokit/prompter-clack',
        from: 'npm:@pokit/prompter-clack@0.1.0',
        to: 'npm:@pokit/prompter-clack@0.2.0',
      },
      { key: 'pokit', from: '0.0.38', to: '0.0.39' },
    ]);
  });

  test('warns (does not touch) root pok deps outside this publish', () => {
    const published = new Map([['@pokit/core', '0.2.0']]);
    const { repins, warnings } = computeRepins(rootDeps, published);
    expect(repins).toEqual([
      { key: '@pokit/core', from: 'npm:@pokit/core@0.1.0', to: 'npm:@pokit/core@0.2.0' },
    ]);
    expect(warnings).toHaveLength(3);
    expect(warnings.join('\n')).toContain('@pokit/reporter-clack');
    expect(warnings.join('\n')).toContain('pokit');
  });

  test('published packages not pinned at root are ignored (e.g. @pokit/terminal today)', () => {
    const published = new Map([
      ['@pokit/core', '0.2.0'],
      ['@pokit/terminal', '0.2.0'],
      ['@pokit/reporter-clack', '0.2.0'],
      ['@pokit/prompter-clack', '0.2.0'],
      ['pokit', '0.0.39'],
      ['create-pokit', '0.0.39'],
    ]);
    const { repins, warnings } = computeRepins(rootDeps, published);
    expect(warnings).toEqual([]);
    expect(repins.map((r) => r.key).sort()).toEqual([
      '@pokit/core',
      '@pokit/prompter-clack',
      '@pokit/reporter-clack',
      'pokit',
    ]);
  });

  test('is a no-op when the pin already matches the published version', () => {
    const published = new Map([['@pokit/core', '0.1.0']]);
    const { repins } = computeRepins({ '@pokit/core': 'npm:@pokit/core@0.1.0' }, published);
    expect(repins).toEqual([]);
  });

  test('never touches non-pok deps', () => {
    const published = new Map([['typescript', '9.9.9']]);
    const { repins, warnings } = computeRepins({ typescript: '^5.8.3' }, published);
    expect(repins).toEqual([]);
    expect(warnings).toEqual([]);
  });
});

describe('computeAheadVersion', () => {
  test('opens the next patch dev prerelease, keeping the patch line shippable', () => {
    expect(computeAheadVersion('0.1.0')).toBe('0.1.1-dev.0');
    expect(computeAheadVersion('0.2.1')).toBe('0.2.2-dev.0');
    expect(computeAheadVersion('0.0.39')).toBe('0.0.40-dev.0');
    expect(computeAheadVersion('1.4.2')).toBe('1.4.3-dev.0');
  });

  test('result is strictly ahead of the published version', () => {
    const semver = require('semver');
    for (const v of ['0.1.0', '0.0.39', '2.3.4']) {
      expect(semver.gt(computeAheadVersion(v), v)).toBe(true);
    }
  });

  test('throws on garbage', () => {
    expect(() => computeAheadVersion('not-a-version')).toThrow();
  });
});

describe('computeReconcileBump', () => {
  test('returns null when the workspace is already strictly ahead (idempotent)', () => {
    expect(computeReconcileBump('0.4.1-dev.0', '0.4.0')).toBeNull();
    expect(computeReconcileBump('0.5.0', '0.4.0')).toBeNull();
  });

  test('opens the next dev version when workspace equals published', () => {
    expect(computeReconcileBump('0.4.0', '0.4.0')).toBe('0.4.1-dev.0');
  });

  test('advances past published when workspace lags behind', () => {
    expect(computeReconcileBump('0.3.1', '0.4.0')).toBe('0.4.1-dev.0');
  });

  test('throws on garbage', () => {
    expect(() => computeReconcileBump('nope', '0.4.0')).toThrow();
    expect(() => computeReconcileBump('0.4.0', 'nope')).toThrow();
  });
});

describe('findBrokenInvariant', () => {
  const rootPinned = new Map([
    ['@pokit/core', '0.1.0'],
    ['pokit', '0.0.38'],
  ]);

  test('clean when workspace is ahead of every pin', () => {
    const workspace = new Map([
      ['@pokit/core', '0.2.0-dev.0'],
      ['pokit', '0.0.39'],
      ['@pokit/terminal', '0.2.0-dev.0'],
    ]);
    expect(findBrokenInvariant(workspace, rootPinned)).toEqual([]);
  });

  test('flags workspace versions equal to a root pin', () => {
    const workspace = new Map([
      ['@pokit/core', '0.1.0'],
      ['pokit', '0.0.39'],
    ]);
    expect(findBrokenInvariant(workspace, rootPinned)).toEqual([
      { name: '@pokit/core', version: '0.1.0' },
    ]);
  });

  test('ignores workspace packages not pinned at root', () => {
    const workspace = new Map([['@pokit/op', '0.1.0']]);
    expect(findBrokenInvariant(workspace, rootPinned)).toEqual([]);
  });
});

describe('isWorkspaceLinked', () => {
  const root = '/repo';

  test('flags realpaths inside the workspace packages dir', () => {
    expect(isWorkspaceLinked('/repo/packages/core', root)).toBe(true);
    expect(isWorkspaceLinked('/repo/packages/terminal/dist', root)).toBe(true);
  });

  test('accepts registry-resolved store paths', () => {
    expect(
      isWorkspaceLinked('/repo/node_modules/.pnpm/@pokit+core@0.1.0/node_modules/@pokit/core', root),
    ).toBe(false);
    expect(
      isWorkspaceLinked('/repo/node_modules/.bun/@pokit+core@0.1.0/node_modules/@pokit/core', root),
    ).toBe(false);
  });

  test('does not false-positive on sibling dirs with the packages prefix', () => {
    expect(isWorkspaceLinked('/repo/packages-archive/core', root)).toBe(false);
  });
});
