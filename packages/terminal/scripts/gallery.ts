/**
 * Live gallery: replay reporter scenarios in a real terminal.
 *
 * Renders each scenario through the real adapter with short delays between
 * events, so spinners, colors, and rail drawing appear exactly as end users
 * see them. Use it for taste reviews of rendering changes.
 *
 *   bun packages/terminal/scripts/gallery.ts             # all scenarios
 *   bun packages/terminal/scripts/gallery.ts parallel    # scenarios matching "parallel"
 *   DELAY=400 bun packages/terminal/scripts/gallery.ts   # slow down replay
 *   THEME=minimal bun packages/terminal/scripts/gallery.ts # preview a preset
 */

import pc from 'picocolors';
import { createEventBus, detectOutputConfig } from '@pokit/core';
import { createReporterAdapter } from '../src/reporter/adapter';
import { SCENARIOS } from '../test/reporter/scenarios';

const filter = process.argv[2];
const delay = Number(process.env.DELAY ?? 150);
const theme = process.env.THEME ? { preset: process.env.THEME as 'rail' | 'minimal' } : undefined;

const scenarios = filter ? SCENARIOS.filter((s) => s.name.includes(filter)) : SCENARIOS;

if (scenarios.length === 0) {
  console.error(`No scenarios match "${filter}"`);
  process.exit(1);
}

for (const scenario of scenarios) {
  console.log();
  console.log(pc.inverse(` ${scenario.name} `) + ' ' + pc.dim(scenario.description));
  console.log();

  const bus = createEventBus();
  const adapter = createReporterAdapter({ output: detectOutputConfig(process.argv.slice(3)), theme });
  const controller = adapter.start(bus);

  for (const event of scenario.events) {
    bus.emit(event);
    await Bun.sleep(delay);
  }

  controller.stop();
  await Bun.sleep(delay);
}
