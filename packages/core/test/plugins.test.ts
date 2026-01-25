import { describe, it, expect } from 'bun:test';
import * as path from 'path';
import { defineCommand } from '../src/lib/command';
import { 
    compose, 
    fromStatic, 
    mountFrom, 
    resolveMountable,
    fromDirectory
} from '../src/lib/plugins';
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

        const mountable = compose(
            fromStatic({ 'a': cmd1 }),
            fromStatic({ 'b': cmd2 })
        );

        const result = await resolveMountable(mountable, mockContext);
        
        expect(result.tree.has('a')).toBe(true);
        expect(result.tree.has('b')).toBe(true);
        expect(result.tree.get('a')?.config).toBe(cmd1);
        expect(result.tree.get('b')?.config).toBe(cmd2);
    });

    it('fails fast on root composition collisions', async () => {
        const cmd1 = defineCommand({ label: 'cmd1', run: () => {} });
        const cmd2 = defineCommand({ label: 'cmd2', run: () => {} });

        const mountable = compose(
            fromStatic({ 'dup': cmd1 }),
            fromStatic({ 'dup': cmd2 })
        );

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

        const mountable = compose(
            customStatic({ 'a': cmd1 }, 'source-a'),
        );

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
                'sub': defineCommand({
                    label: 'Sub',
                    run: () => {}
                })
            })
        });

        const ctx = {
            config: {
                commandsDir: '/tmp', // dummy
                projectRoot: '/tmp',
                reporterAdapter: createRawReporterAdapter(),
                prompter: createRawPrompter(),
                extraCommands: {
                    'root': rootCmd
                }
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

    it('does not treat missing mountSourceId as a cycle', async () => {
        let calls = 0;
        const mountWithoutId = async () => {
            calls += 1;
            return { tree: new Map(), mountSourceId: undefined } as any;
        };

        const cmdA = defineCommand({ label: 'A', mount: mountWithoutId });
        const cmdB = defineCommand({ label: 'B', mount: mountWithoutId });

        const ctx = {
            config: {
                commandsDir: '/tmp', // dummy
                projectRoot: '/tmp',
                reporterAdapter: createRawReporterAdapter(),
                prompter: createRawPrompter(),
                extraCommands: {
                    'a': cmdA,
                    'b': cmdB
                }
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

        await buildCommandTree('/tmp/dummy', ctx as any);

        expect(calls).toBe(2);
    });

    it('mounts plugins from config at root', async () => {
        const pluginCmd = defineCommand({ label: 'Plugin Cmd', run: () => {} });
        
        const ctx = {
            config: {
                commandsDir: '/tmp', // dummy
                projectRoot: '/tmp',
                reporterAdapter: createRawReporterAdapter(),
                prompter: createRawPrompter(),
                plugins: [
                    fromStatic({ 'plugin-cmd': pluginCmd })
                ]
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
});
