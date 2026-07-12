/**
 * Snapshot gallery for reporter rendering.
 *
 * Renders every scenario in scenarios.ts through the real adapter into an
 * xterm-headless virtual terminal, and compares the visible screen against a
 * committed snapshot in __gallery__/. The snapshots are plain text, so a
 * visual change shows up as a readable diff in review.
 *
 * To update snapshots after an intentional rendering change:
 *
 *   UPDATE_GALLERY=1 bun test gallery
 *
 * Then eyeball the diff (or run scripts/gallery.ts for a live render) before
 * committing.
 */

import { describe, it, expect, afterEach } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createEventBus } from '@pokit/core';
import { createReporterAdapter } from '../../src/reporter/adapter';
import { createVirtualTerminal, type VirtualTerminal } from './utils';
import { SCENARIOS, OUTPUT_MODES, type Scenario, type OutputMode } from './scenarios';

const GALLERY_DIR = join(import.meta.dir, '__gallery__');
const UPDATE = process.env.UPDATE_GALLERY === '1';

async function render(scenario: Scenario, mode: OutputMode, vt: VirtualTerminal): Promise<string> {
  const bus = createEventBus();
  const adapter = createReporterAdapter({ output: { ...mode.output }, theme: mode.theme });
  const controller = adapter.start(bus);
  for (const event of scenario.events) {
    bus.emit(event);
  }
  controller.stop();
  return vt.screenshotText();
}

describe('reporter gallery', () => {
  let vt: VirtualTerminal | undefined;

  afterEach(() => {
    vt?.restore();
    vt = undefined;
  });

  for (const mode of OUTPUT_MODES) {
    for (const scenario of SCENARIOS) {
      it(`${scenario.name} [${mode.name}]`, async () => {
        vt = createVirtualTerminal();
        const screen = await render(scenario, mode, vt);
        vt.restore();

        const snapshotPath = join(GALLERY_DIR, `${scenario.name}.${mode.name}.txt`);
        const body = `# ${scenario.name} [${mode.name}]\n# ${scenario.description}\n\n${screen}\n`;

        if (UPDATE || !existsSync(snapshotPath)) {
          mkdirSync(GALLERY_DIR, { recursive: true });
          writeFileSync(snapshotPath, body);
          return;
        }

        expect(body).toBe(readFileSync(snapshotPath, 'utf8'));
      });
    }
  }
});
