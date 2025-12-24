/**
 * Fixture Generator for Clack Reporter Adapter Tests
 *
 * Generates TypeScript fixture files containing expected terminal screenshots.
 * Run with: bun test/generate-fixtures.ts
 */

import { createEventBus, type CLIEvent } from '@openpok/core';
import { createReporterAdapter } from '@openpok/reporter-clack';
import { createVirtualTerminal } from './utils';
import * as cliFixtures from '../core/fixtures';
import { writeFileSync } from 'fs';
import { join } from 'path';

const FIXTURES_DIR = join(import.meta.dir, 'fixtures');

type FixtureDefinition = {
  name: string;
  events: CLIEvent[];
  description: string;
};

// Define all test cases
const fixtures: FixtureDefinition[] = [
  {
    name: 'sequential-group',
    description:
      'Sequential group with activities from taskWithReporter fixture',
    events: cliFixtures.taskWithReporter.events,
  },
  {
    name: 'activity-success',
    description: 'Successful activity with checkmark symbol',
    events: [
      {
        type: 'group:start',
        id: 'g1',
        label: 'Test Group',
        layout: 'sequence',
      },
      { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'My Task' },
      { type: 'activity:success', id: 'a1' },
      { type: 'group:end', id: 'g1' },
    ],
  },
  {
    name: 'activity-failure',
    description: 'Failed activity with error message',
    events: [
      {
        type: 'group:start',
        id: 'g1',
        label: 'Test Group',
        layout: 'sequence',
      },
      {
        type: 'activity:start',
        id: 'a1',
        parentId: 'g1',
        label: 'Failing Task',
      },
      { type: 'activity:failure', id: 'a1', error: 'Something went wrong' },
      { type: 'group:end', id: 'g1' },
    ],
  },
  {
    name: 'log-info',
    description: 'Info log message',
    events: [{ type: 'log', level: 'info', message: 'Information message' }],
  },
  {
    name: 'log-success',
    description: 'Success log message',
    events: [{ type: 'log', level: 'success', message: 'Success message' }],
  },
  {
    name: 'log-error',
    description: 'Error log message',
    events: [{ type: 'log', level: 'error', message: 'Error message' }],
  },
  {
    name: 'log-warn',
    description: 'Warning log message',
    events: [{ type: 'log', level: 'warn', message: 'Warning message' }],
  },
  {
    name: 'log-step',
    description: 'Step log message',
    events: [{ type: 'log', level: 'step', message: 'Step message' }],
  },
  {
    name: 'multiple-activities',
    description: 'Multiple activities in sequence',
    events: [
      { type: 'group:start', id: 'g1', label: 'Build', layout: 'sequence' },
      { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Compile' },
      { type: 'activity:success', id: 'a1' },
      { type: 'activity:start', id: 'a2', parentId: 'g1', label: 'Bundle' },
      { type: 'activity:success', id: 'a2' },
      { type: 'activity:start', id: 'a3', parentId: 'g1', label: 'Minify' },
      { type: 'activity:success', id: 'a3' },
      { type: 'group:end', id: 'g1' },
    ],
  },
  {
    name: 'parallel-group-success',
    description: 'Parallel group with successful activities',
    events: [
      {
        type: 'group:start',
        id: 'g1',
        label: 'Parallel Tasks',
        layout: 'parallel',
      },
      { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Task A' },
      { type: 'activity:start', id: 'a2', parentId: 'g1', label: 'Task B' },
      { type: 'activity:success', id: 'a1' },
      { type: 'activity:success', id: 'a2' },
      { type: 'group:end', id: 'g1' },
    ],
  },
  {
    name: 'parallel-group-failure',
    description: 'Parallel group with one failing activity',
    events: [
      {
        type: 'group:start',
        id: 'g1',
        label: 'Parallel Tasks',
        layout: 'parallel',
      },
      { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Task A' },
      { type: 'activity:start', id: 'a2', parentId: 'g1', label: 'Task B' },
      { type: 'activity:success', id: 'a1' },
      { type: 'activity:failure', id: 'a2', error: 'Task B failed' },
      { type: 'group:end', id: 'g1' },
    ],
  },
  {
    name: 'suspend-resume',
    description: 'Suspend and resume reporter',
    events: [
      { type: 'group:start', id: 'g1', label: 'Test', layout: 'sequence' },
      { type: 'activity:start', id: 'a1', parentId: 'g1', label: 'Running' },
      { type: 'reporter:suspend' },
      { type: 'log', level: 'info', message: 'Should not appear' },
      { type: 'reporter:resume' },
      { type: 'activity:success', id: 'a1' },
      { type: 'group:end', id: 'g1' },
    ],
  },
];

async function generateFixture(fixture: FixtureDefinition): Promise<string[]> {
  const vt = createVirtualTerminal();
  const bus = createEventBus();
  const adapter = createReporterAdapter();
  const controller = adapter.start(bus);

  for (const event of fixture.events) {
    bus.emit(event);
  }

  controller.stop();
  const lines = await vt.screenshot();
  vt.restore();

  return lines;
}

function toTypeScriptFile(
  _name: string,
  description: string,
  lines: string[]
): string {
  const linesArray = lines
    .map((line) => `  ${JSON.stringify(line)},`)
    .join('\n');

  return `/**
 * Expected terminal output for: ${description}
 *
 * Auto-generated by test/generate-fixtures.ts
 */

/**
 * Terminal screenshot as array of lines
 */
export const lines: string[] = [
${linesArray}
];

/**
 * Terminal screenshot as single string
 */
export const text: string = lines.join('\\n');
`;
}

async function main() {
  console.log('Generating fixtures...\n');

  for (const fixture of fixtures) {
    const lines = await generateFixture(fixture);
    const content = toTypeScriptFile(fixture.name, fixture.description, lines);
    const filePath = join(FIXTURES_DIR, `${fixture.name}.ts`);

    writeFileSync(filePath, content);
    console.log(`✓ ${fixture.name}.ts`);
    console.log(`  ${lines.length} lines`);
  }

  // Generate index file
  const indexContent = `/**
 * Clack Reporter Adapter Test Fixtures
 *
 * Auto-generated terminal screenshots for testing.
 */

${fixtures.map((f) => `export * as ${toCamelCase(f.name)} from './${f.name}';`).join('\n')}
`;

  writeFileSync(join(FIXTURES_DIR, 'index.ts'), indexContent);
  console.log('\n✓ index.ts');

  console.log('\nDone!');
}

function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

main().catch(console.error);
