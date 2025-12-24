export * as simpleCommand from '../../cases/01-simple/events';
export * as commandWithContext from '../../cases/02-with-context/events';
export * as commandWithPre from '../../cases/03-with-pre/events';

import { eventsDev, eventsStaging } from '../../cases/04-with-dynamic-pre/events';
export const commandWithDynamicPreDev = { events: eventsDev };
export const commandWithDynamicPreStaging = { events: eventsStaging };

export * as menuNavigation from '../../cases/18-menu-navigation/events';
export * as runAllChildren from '../../cases/15-run-all/events';
export * as taskWithReporter from '../../cases/08-with-reporter/events';
