import { describe, it, expect, beforeEach } from 'bun:test';
import * as path from 'path';
import { z } from 'zod';
import { captureEvents } from './utils';
import { calls, resetCalls } from '../../../test/cases/22-with-hooks/command';
import {
  calls as pluginCalls,
  resetCalls as resetPluginCalls,
} from './fixtures/plugin-hooks/_calls';
import { defineCommand, definePreCommand, definePostCommand } from '../src/lib/command';
import { fromStatic } from '../src/lib/plugins';

describe('Lifecycle hooks (definePreCommand / definePostCommand)', () => {
  beforeEach(() => {
    resetCalls();
  });

  it('runs the full lifecycle in order: pre.checks, pre.run, main.checks, main.run, post.checks, post.run', async () => {
    const { error } = await captureEvents(['with-hooks']);
    expect(error).toBeUndefined();
    expect(calls).toEqual([
      'pre.check',
      'pre.run',
      'main.check',
      'main.run prepared=true',
      'post.check',
      'post.run input=pkg-a,pkg-b',
    ]);
  });

  it('merges the pre-command return value into the main context', async () => {
    await captureEvents(['with-hooks']);
    expect(calls).toContain('main.run prepared=true');
  });

  it('passes the main return value to post as typed input', async () => {
    await captureEvents(['with-hooks']);
    expect(calls).toContain('post.run input=pkg-a,pkg-b');
  });

  it('skips the post-command when the main run throws', async () => {
    const { error } = await captureEvents(['with-hooks', '--fail']);
    expect(error).toBeDefined();
    expect(calls).toEqual(['pre.check', 'pre.run', 'main.check', 'main.run prepared=true']);
  });

  it('invokes the pre-command directly via its colon name', async () => {
    const { error } = await captureEvents(['pre:with-hooks']);
    expect(error).toBeUndefined();
    expect(calls).toEqual(['pre.check', 'pre.run']);
  });

  it('invokes the post-command directly with input undefined', async () => {
    const { error } = await captureEvents(['post:with-hooks']);
    expect(error).toBeUndefined();
    expect(calls).toEqual(['post.check', 'post.run input=none']);
  });

  it('hides hook nodes from root help but keeps the main command visible', async () => {
    const { stdout } = await captureEvents(['--help']);
    expect(stdout).toContain('with-hooks');
    expect(stdout).not.toContain('pre:with-hooks');
    expect(stdout).not.toContain('post:with-hooks');
  });
});

describe('Lifecycle hooks on commands mounted by plugins', () => {
  const commandsDir = path.join(import.meta.dir, 'fixtures/plugin-hooks');
  const published = z.object({ published: z.array(z.string()) });

  const plugin = () =>
    fromStatic({
      publish: defineCommand({
        label: 'Publish',
        context: {
          fail: { from: 'flag', schema: z.boolean().default(false), description: 'Fail' },
        },
        output: published,
        run: async (_r, { context }) => {
          pluginCalls.push('publish.run');
          if (context.fail) throw new Error('publish failed');
          return { published: ['pkg-a@1.0.0'] };
        },
      }),
      docs: defineCommand({
        label: 'Docs',
        mount: fromStatic({
          build: defineCommand({
            label: 'Build docs',
            run: async (_r, { context }) => {
              pluginCalls.push(
                `build.run prepared=${(context as Record<string, unknown>).prepared === true}`
              );
            },
          }),
        }),
      }),
    });

  beforeEach(() => {
    resetPluginCalls();
  });

  it('runs a hooks-only route file post-command after the plugin command, with its output', async () => {
    const { error } = await captureEvents(['publish'], { commandsDir, plugins: [plugin()] });
    expect(error).toBeUndefined();
    expect(pluginCalls).toEqual(['publish.run', 'post.run input=pkg-a@1.0.0']);
  });

  it('skips the post-command when the plugin command fails', async () => {
    const { error } = await captureEvents(['publish', '--fail'], {
      commandsDir,
      plugins: [plugin()],
    });
    expect(error).toBeDefined();
    expect(pluginCalls).toEqual(['publish.run']);
  });

  it('invokes the post-command directly with input undefined', async () => {
    const { error } = await captureEvents(['post:publish'], { commandsDir, plugins: [plugin()] });
    expect(error).toBeUndefined();
    expect(pluginCalls).toEqual(['post.run input=none']);
  });

  it('attaches to a command nested inside a plugin mount', async () => {
    const { error } = await captureEvents(['docs', 'build'], { commandsDir, plugins: [plugin()] });
    expect(error).toBeUndefined();
    expect(pluginCalls).toEqual(['pre.run', 'build.run prepared=true']);

    resetPluginCalls();
    await captureEvents(['pre:docs.build'], { commandsDir, plugins: [plugin()] });
    expect(pluginCalls).toEqual(['pre.run']);
  });

  it('warns and ignores a lifecycle command whose target does not exist', async () => {
    const { error, events } = await captureEvents(['local'], { commandsDir, plugins: [plugin()] });
    expect(error).toBeUndefined();
    expect(JSON.stringify(events)).toContain(
      '\\"post:ghost\\" is a lifecycle command for \\"ghost\\", but no runnable command exists there'
    );

    const missing = await captureEvents(['post:ghost'], { commandsDir, plugins: [plugin()] });
    expect(missing.error).toBeDefined();
  });

  it('does not mutate the plugin command config', async () => {
    const mountable = plugin();
    await captureEvents(['publish'], { commandsDir, plugins: [mountable] });
    const result = await mountable({} as any);
    expect(result.tree.get('publish')!.config.hooks).toBeUndefined();
  });

  it('lets a plugin hook its own command with definePostCommand', async () => {
    const own = fromStatic({
      deploy: defineCommand({
        label: 'Deploy',
        output: published,
        run: async () => {
          pluginCalls.push('deploy.run');
          return { published: ['site'] };
        },
      }),
      'post:deploy': definePostCommand({
        label: 'After deploy',
        input: published.optional(),
        run: async (_r, ctx) => {
          pluginCalls.push(`deploy.post input=${ctx.input?.published.join(',') ?? 'none'}`);
        },
      }),
    });
    const { error, stdout } = await captureEvents(['--help'], { commandsDir, plugins: [own] });
    expect(error).toBeUndefined();
    expect(stdout).not.toContain('post:deploy');

    await captureEvents(['deploy'], { commandsDir, plugins: [own] });
    expect(pluginCalls).toEqual(['deploy.run', 'deploy.post input=site']);

    resetPluginCalls();
    await captureEvents(['post:deploy'], { commandsDir, plugins: [own] });
    expect(pluginCalls).toEqual(['deploy.post input=none']);
  });

  it('lets a plugin hook a nested command with a dotted lifecycle name', async () => {
    const nested = fromStatic({
      site: defineCommand({
        label: 'Site',
        mount: fromStatic({
          deploy: defineCommand({ label: 'Deploy site', run: () => void pluginCalls.push('run') }),
        }),
      }),
      'pre:site.deploy': definePreCommand({
        label: 'Before site deploy',
        run: () => void pluginCalls.push('pre'),
      }),
    });
    const { error } = await captureEvents(['site', 'deploy'], { commandsDir, plugins: [nested] });
    expect(error).toBeUndefined();
    expect(pluginCalls).toEqual(['pre', 'run']);
  });

  it('rejects a lifecycle command mounted under a non-lifecycle name', async () => {
    const wrong = fromStatic({
      'after-deploy': definePostCommand({ label: 'After deploy', run: () => {} }),
    });
    const { error } = await captureEvents(['local'], { commandsDir, plugins: [wrong] });
    expect(error?.message).toContain('"after-deploy" is a post-command; mount it as "post:<command>"');
  });

  it('rejects a second post-command for the same command', async () => {
    const twice = fromStatic({
      'post:publish': definePostCommand({ label: 'Plugin post', run: () => {} }),
    });
    const { error } = await captureEvents(['publish'], {
      commandsDir,
      plugins: [plugin(), twice],
    });
    expect(error?.message).toContain('Command collision: "post:publish"');
  });
});
