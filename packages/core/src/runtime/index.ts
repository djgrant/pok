/**
 * Runtime abstraction layer for cross-runtime support (Bun and Node.js)
 *
 * This module provides a unified interface for runtime-specific functionality,
 * automatically selecting the appropriate implementation based on the current runtime.
 */

 import type { Runtime } from './types';
 import * as fs from 'fs';
 import * as path from 'path';
 
 /**
  * Detect if running in Bun runtime

 */
export function isBun(): boolean {
  return typeof globalThis.Bun !== 'undefined';
}

/**
 * Detect if running in Node.js runtime
 */
export function isNode(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.versions != null &&
    process.versions.node != null &&
    !isBun()
  );
}

/**
 * Get the current runtime name
 */
export function getRuntimeName(): 'bun' | 'node' {
  return isBun() ? 'bun' : 'node';
}

// Runtime singleton - lazily initialized
let runtimeInstance: Runtime | null = null;

 /**
  * Get the runtime implementation for the current environment.
  * Returns a cached instance after first initialization.
  */
 export async function getRuntime(): Promise<Runtime> {
   if (runtimeInstance) {
     return runtimeInstance;
   }
 
   if (isBun()) {
     const { createBunRuntime } = await import('./bun');
     runtimeInstance = createBunRuntime();
   } else {
     const { createNodeRuntime } = await import('./node');
     runtimeInstance = createNodeRuntime();
   }
 
   return runtimeInstance;
 }
 
 /**
  * Detect the package manager used in the project
  */
 export function getPackageManager(projectRoot: string): 'npm' | 'pnpm' | 'yarn' | 'bun' {
   if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) return 'pnpm';
   if (fs.existsSync(path.join(projectRoot, 'bun.lockb')) || fs.existsSync(path.join(projectRoot, 'bun.lock')))
     return 'bun';
   if (fs.existsSync(path.join(projectRoot, 'yarn.lock'))) return 'yarn';
   return 'npm';
 }
 
 // Re-export types

export type {
  Runtime,
  SpawnOptions,
  SpawnResult,
  ShellOptions,
  ShellResult,
  GlobOptions,
} from './types';
