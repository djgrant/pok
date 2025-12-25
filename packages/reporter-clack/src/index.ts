/**
 * @openpok/reporter-clack
 *
 * Clack-based implementation of the ReporterAdapter interface.
 * Consumes CLI events and renders them using @clack/prompts.
 */

export { createReporterAdapter } from './adapter';
export type { ReporterAdapterOptions } from './adapter';

// Symbol exports for custom formatting
export { getSymbols, UNICODE_SYMBOLS, ASCII_SYMBOLS } from './symbols';
export type { SymbolSet } from './symbols';
