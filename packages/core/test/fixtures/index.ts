/**
 * Test fixtures for @pokit/core tests
 *
 * These fixtures re-export event sequences from integration test cases.
 */

export * as simpleCommand from '../../../../test/cases/01-simple/events';
export * as commandWithContext from '../../../../test/cases/02-with-context/events';
export * as commandWithPre from '../../../../test/cases/03-with-pre/events';

import { eventsDev, eventsStaging } from '../../../../test/cases/04-with-dynamic-pre/events';
export const commandWithDynamicPreDev = { events: eventsDev };
export const commandWithDynamicPreStaging = { events: eventsStaging };

export * as menuNavigation from '../../../../test/cases/18-menu-navigation/events';
export * as runAllChildren from '../../../../test/cases/15-run-all/events';
export * as taskWithReporter from '../../../../test/cases/08-with-reporter/events';
export * as commandWithFailingPreRemediation from '../../../../test/cases/19-with-failing-pre-remediation/events';
