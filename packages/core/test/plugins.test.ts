import { describe, it, expect } from 'bun:test';
import * as path from 'path';
import { defineCommand } from '../src/lib/command';
import { compose, fromStatic, resolveMountable, fromDirectory } from '../src/lib/plugins';
import { buildCommandTree } from '../src/lib/router';
import { createRawPrompter } from '../src/prompter';
import { createRawReporterAdapter } from '../src/events';

// Mock context for testing
const mockContext = {
  projectRoot: '/tmp/test-project',
  reporter: {} as any, // Mock reporter if needed
  prompter: {} as any,
  path: [],
  config: {},
};

describe('Plugin System', () => {
  it('composes multiple sources', async () => {
    const cmd1 = defineCommand({ label: 'cmd1', run: () => {} });
    const cmd2 = defineCommand({ label: 'cmd2', run: () => {} });

    const mountable = compose(fromStatic({ a: cmd1 }), fromStatic({ b: cmd2 }));

    const result = await resolveMountable(mountable, mockContext);

    expect(result.tree.has('a')).toBe(true);
    expect(result.tree.has('b')).toBe(true);
    expect(result.tree.get('a')?.config).toBe(cmd1);
    expect(result.tree.get('b')?.config).toBe(cmd2);
  });

  it('fails fast on root composition collisions', async () => {
    const cmd1 = defineCommand({ label: 'cmd1', run: () => {} });
    const cmd2 = defineCommand({ label: 'cmd2', run: () => {} });

    const mountable = compose(fromStatic({ dup: cmd1 }), fromStatic({ dup: cmd2 }));

    await expect(resolveMountable(mountable, mockContext)).rejects.toThrow(
      'Command collision: "dup" already exists at root composition'
    );
  });

  it('tracks provenance in composed tree', async () => {
    const cmd1 = defineCommand({ label: 'cmd1', run: () => {} });

    // Helper to force a specific ID for testing
    const customStatic = (cmds: any, id: string) => {
      const m = fromStatic(cmds);
      return async (ctx: any) => {
        const res = await m(ctx);
        res.mountSourceId = id;
        return res;
      };
    };

    const mountable = compose(customStatic({ a: cmd1 }, 'source-a'));

    const result = await resolveMountable(mountable, mockContext);
    // Note: buildCommandTree does the expansion/tagging, but compose also does merging.
    // If compose merges, it should tag.

    expect(result.tree.get('a')?.source).toBe('source-a');
  });

  it('mounts sub-apps recursively', async () => {
    // This requires a full buildCommandTree run to test recursive expansion

    const rootCmd = defineCommand({
      label: 'Root',
      mount: fromStatic({
        sub: defineCommand({
          label: 'Sub',
          run: () => {},
        }),
      }),
    });

    const ctx = {
      config: {
        commandsDir: '/tmp', // dummy
        projectRoot: '/tmp',
        reporterAdapter: createRawReporterAdapter(),
        prompter: createRawPrompter(),
        extraCommands: {
          root: rootCmd,
        },
      },
      projectRoot: '/tmp',
      reporter: {
        error: () => {},
        warn: () => {},
      } as any,
      prompter: {} as any,
      adapterController: { stop: () => {} } as any,
      appName: 'test-app',
      eventBus: { emit: () => {}, on: () => () => {} } as any,
    };

    const tree = await buildCommandTree('/tmp/dummy', ctx as any);

    expect(tree.has('root')).toBe(true);
    const rootNode = tree.get('root')!;
    expect(rootNode.children.has('sub')).toBe(true);

    expect(rootNode.children.get('sub')?.source).toContain('static:');
  });

  it('fails fast when a mount result is missing mountSourceId', async () => {
    const mountWithoutId = async () => {
      return { tree: new Map(), mountSourceId: undefined } as any;
    };

    const cmdA = defineCommand({ label: 'A', mount: mountWithoutId });

    const ctx = {
      config: {
        commandsDir: '/tmp', // dummy
        projectRoot: '/tmp',
        reporterAdapter: createRawReporterAdapter(),
        prompter: createRawPrompter(),
        extraCommands: {
          a: cmdA,
        },
      },
      projectRoot: '/tmp',
      reporter: {
        error: () => {},
        warn: () => {},
      } as any,
      prompter: {} as any,
      adapterController: { stop: () => {} } as any,
      appName: 'test-app',
      eventBus: { emit: () => {}, on: () => () => {} } as any,
    };

    await expect(buildCommandTree('/tmp/dummy', ctx as any)).rejects.toThrow(
      /missing mountSourceId/
    );
  });

  it('fails fast on a mount-time command collision', async () => {
    // The parent statically defines a child "sub" AND mounts another "sub".
    const parentCmd = defineCommand({
      label: 'Parent',
      mount: fromStatic({
        sub: defineCommand({ label: 'Mounted Sub', run: () => {} }),
      }),
    });

    const ctx = {
      config: {
        commandsDir: '/tmp', // dummy
        projectRoot: '/tmp',
        reporterAdapter: createRawReporterAdapter(),
        prompter: createRawPrompter(),
        extraCommands: {
          parent: parentCmd,
          'parent.sub': defineCommand({ label: 'Static Sub', run: () => {} }),
        },
      },
      projectRoot: '/tmp',
      reporter: {
        error: () => {},
        warn: () => {},
      } as any,
      prompter: {} as any,
      adapterController: { stop: () => {} } as any,
      appName: 'test-app',
      eventBus: { emit: () => {}, on: () => () => {} } as any,
    };

    await expect(buildCommandTree('/tmp/dummy', ctx as any)).rejects.toThrow(
      /Command collision/
    );
  });

  it('fails fast on a cycle (self-referential mount source on one branch)', async () => {
    // Force a stable mountSourceId that recurs down a single branch.
    const withId = (m: any, id: string) => async (ctx: any) => {
      const res = await resolveMountable(m, ctx);
      res.mountSourceId = id;
      return res;
    };

    // Child B re-mounts the same source id ("cyclic") as its parent A.
    const childB = defineCommand({
      label: 'B',
      mount: withId(fromStatic({ leaf: defineCommand({ label: 'Leaf', run: () => {} }) }), 'cyclic'),
    });

    const parentA = defineCommand({
      label: 'A',
      mount: withId(fromStatic({ b: childB }), 'cyclic'),
    });

    const ctx = {
      config: {
        commandsDir: '/tmp', // dummy
        projectRoot: '/tmp',
        reporterAdapter: createRawReporterAdapter(),
        prompter: createRawPrompter(),
        extraCommands: {
          a: parentA,
        },
      },
      projectRoot: '/tmp',
      reporter: {
        error: () => {},
        warn: () => {},
      } as any,
      prompter: {} as any,
      adapterController: { stop: () => {} } as any,
      appName: 'test-app',
      eventBus: { emit: () => {}, on: () => () => {} } as any,
    };

    await expect(buildCommandTree('/tmp/dummy', ctx as any)).rejects.toThrow(
      /Cycle detected/
    );
  });

  it('allows a diamond (same mount source on separate branches)', async () => {
    const withId = (m: any, id: string) => async (ctx: any) => {
      const res = await resolveMountable(m, ctx);
      res.mountSourceId = id;
      return res;
    };

    // Both parents mount the SAME source id, but on separate root branches.
    const shared = withId(
      fromStatic({ leaf: defineCommand({ label: 'Leaf', run: () => {} }) }),
      'shared-id'
    );

    const p1 = defineCommand({ label: 'P1', mount: shared });
    const p2 = defineCommand({ label: 'P2', mount: shared });

    const ctx = {
      config: {
        commandsDir: '/tmp', // dummy
        projectRoot: '/tmp',
        reporterAdapter: createRawReporterAdapter(),
        prompter: createRawPrompter(),
        extraCommands: {
          p1,
          p2,
        },
      },
      projectRoot: '/tmp',
      reporter: {
        error: () => {},
        warn: () => {},
      } as any,
      prompter: {} as any,
      adapterController: { stop: () => {} } as any,
      appName: 'test-app',
      eventBus: { emit: () => {}, on: () => () => {} } as any,
    };

    const tree = await buildCommandTree('/tmp/dummy', ctx as any);

    expect(tree.get('p1')?.children.has('leaf')).toBe(true);
    expect(tree.get('p2')?.children.has('leaf')).toBe(true);
  });

  it('mounts a file-based sub-app via fromDirectory', async () => {
    const adminCmd = defineCommand({
      label: 'Admin',
      mount: fromDirectory(import.meta.url, './fixtures/admin'),
    });

    const ctx = {
      config: {
        commandsDir: '/tmp', // dummy
        projectRoot: '/tmp',
        reporterAdapter: createRawReporterAdapter(),
        prompter: createRawPrompter(),
        extraCommands: {
          admin: adminCmd,
        },
      },
      projectRoot: '/tmp',
      reporter: {
        error: () => {},
        warn: () => {},
      } as any,
      prompter: {} as any,
      adapterController: { stop: () => {} } as any,
      appName: 'test-app',
      eventBus: { emit: () => {}, on: () => () => {} } as any,
    };

    const tree = await buildCommandTree('/tmp/dummy', ctx as any);

    const adminNode = tree.get('admin')!;
    expect(adminNode.children.has('users')).toBe(true);
    expect(adminNode.children.has('settings')).toBe(true);
  });

  it('mounts plugins from config at root', async () => {
    const pluginCmd = defineCommand({ label: 'Plugin Cmd', run: () => {} });

    const ctx = {
      config: {
        commandsDir: '/tmp', // dummy
        projectRoot: '/tmp',
        reporterAdapter: createRawReporterAdapter(),
        prompter: createRawPrompter(),
        plugins: [fromStatic({ 'plugin-cmd': pluginCmd })],
      },
      projectRoot: '/tmp',
      reporter: {
        error: () => {},
        warn: () => {},
      } as any,
      prompter: {} as any,
      adapterController: { stop: () => {} } as any,
      appName: 'test-app',
      eventBus: { emit: () => {}, on: () => () => {} } as any,
    };

    const tree = await buildCommandTree('/tmp/dummy', ctx as any);

    expect(tree.has('plugin-cmd')).toBe(true);
    expect(tree.get('plugin-cmd')?.config).toBe(pluginCmd);
  });

  it('stays quiet when an implicit commands dir is missing and plugins mount', async () => {
    const pluginCmd = defineCommand({ label: 'Plugin Cmd', run: () => {} });
    const warns: string[] = [];

    const ctx = {
      config: {
        projectRoot: '/tmp/pok-no-such-app',
        reporterAdapter: createRawReporterAdapter(),
        prompter: createRawPrompter(),
        plugins: [fromStatic({ 'plugin-cmd': pluginCmd })],
      },
      projectRoot: '/tmp/pok-no-such-app',
      reporter: {
        error: () => {},
        warn: (message: string) => warns.push(message),
      } as any,
      prompter: {} as any,
      adapterController: { stop: () => {} } as any,
      appName: 'test-app',
      eventBus: { emit: () => {}, on: () => () => {} } as any,
    };

    const tree = await buildCommandTree(undefined, ctx as any);

    expect(tree.has('plugin-cmd')).toBe(true);
    expect(warns.some((w) => w.includes('does not exist'))).toBe(false);
  });

  it('warns when an explicit commands dir is missing even if plugins mount', async () => {
    const pluginCmd = defineCommand({ label: 'Plugin Cmd', run: () => {} });
    const warns: string[] = [];

    const ctx = {
      config: {
        commandsDir: '/tmp/pok-no-such-commands',
        projectRoot: '/tmp',
        reporterAdapter: createRawReporterAdapter(),
        prompter: createRawPrompter(),
        plugins: [fromStatic({ 'plugin-cmd': pluginCmd })],
      },
      projectRoot: '/tmp',
      reporter: {
        error: () => {},
        warn: (message: string) => warns.push(message),
      } as any,
      prompter: {} as any,
      adapterController: { stop: () => {} } as any,
      appName: 'test-app',
      eventBus: { emit: () => {}, on: () => () => {} } as any,
    };

    const tree = await buildCommandTree('/tmp/pok-no-such-commands', ctx as any);

    expect(tree.has('plugin-cmd')).toBe(true);
    expect(warns.some((w) => w.includes('Commands directory does not exist'))).toBe(true);
  });

  it('errors when the composed tree is empty', async () => {
    const errors: string[] = [];

    const ctx = {
      config: {
        projectRoot: '/tmp/pok-no-such-app',
        reporterAdapter: createRawReporterAdapter(),
        prompter: createRawPrompter(),
      },
      projectRoot: '/tmp/pok-no-such-app',
      reporter: {
        error: (message: string) => errors.push(message),
        warn: () => {},
      } as any,
      prompter: {} as any,
      adapterController: { stop: () => {} } as any,
      appName: 'test-app',
      eventBus: { emit: () => {}, on: () => () => {} } as any,
    };

    await expect(buildCommandTree(undefined, ctx as any)).rejects.toThrow(
      /No commands found/
    );
    expect(errors.some((e) => e.includes('No commands found'))).toBe(true);
  });
});
