import { z } from 'zod';

import type { CommandConfig, ContextDef, ContextFieldDef } from '../lib/command';
import {
  type InferContextInput,
  type InferContextOutput,
  type OptionalizeUndefined,
  type CommandConfigWithOutput,
} from '../lib/command';
import { parseContext, validateRequiredContext } from '../lib/args';
import { createRunner } from '../lib/runner';
import { runPreChecks } from '../lib/prechecks';

import type { CLIEvent } from '../events';
import { createEventBus, createRootReporter, emitRootEnd, createRawReporterAdapter } from '../events';
import type { ReporterAdapter, ReporterAdapterController } from '../events';

import type { Prompter } from '../prompter';
import { createRawPrompter } from '../prompter';
import type { TabsAdapter, AppAdapter } from '../tabs';

export type CommandContextDef<TCmd> = TCmd extends CommandConfig<infer C> ? C : ContextDef;

export type CommandContextInput<TCmd> = InferContextInput<CommandContextDef<TCmd>>;
export type CommandContextOutput<TCmd> = InferContextOutput<CommandContextDef<TCmd>>;

export type CommandReturn<TCmd> = TCmd extends CommandConfigWithOutput<any, infer O>
  ? z.output<O>
  : void;

export type InvokeInput<TCmd> = {
  cwd: string;
  context?: OptionalizeUndefined<CommandContextInput<TCmd>>;
  args?: string[];
  globalContext?: Record<string, unknown>;
};

export type SdkRuntimeOptions = {
  reporterAdapter?: ReporterAdapter;
  prompter?: Prompter;
  tabs?: TabsAdapter;
  app?: AppAdapter;
  onEvent?: (event: CLIEvent) => void;
  quiet?: boolean;
  runPreChecks?: boolean;
  validateOutput?: boolean;
  appName?: string;
  version?: string;
};

export type SdkRuntime = {
  invoke<TCmd extends CommandConfig>(
    command: TCmd,
    input: InvokeInput<TCmd>
  ): Promise<CommandReturn<TCmd>>;
  close(): void;
};

function isStaticContextValue(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function resolveContextForSdk<C extends ContextDef>(
  contextDef: C,
  inputContext: Record<string, unknown> | undefined
): InferContextOutput<C> {
  // Use the same defaulting behavior as CLI parsing (defaults + boolean false, plus static literals).
  const base = parseContext([], contextDef, { ignoreUnknownFlags: true }).context as Record<
    string,
    unknown
  >;

  if (!inputContext) {
    validateRequiredContext(base as any, contextDef);
    return base as InferContextOutput<C>;
  }

  for (const [key, rawValue] of Object.entries(inputContext)) {
    const def = contextDef[key];
    if (def === undefined) {
      throw new Error(`Unknown context field "${key}"`);
    }

    if (isStaticContextValue(def)) {
      throw new Error(`Cannot override static context field "${key}"`);
    }

    const fieldDef = def as ContextFieldDef;
    const parsed = fieldDef.schema.safeParse(rawValue);
    if (!parsed.success) {
      const reason = parsed.error.issues.map((i) => i.message).join(', ');
      throw new Error(`Invalid value for context field "${key}": ${reason}`);
    }

    base[key] = parsed.data;
  }

  validateRequiredContext(base as any, contextDef);
  return base as InferContextOutput<C>;
}

export function createSdkRuntime(options: SdkRuntimeOptions = {}): SdkRuntime {
  const {
    onEvent,
    reporterAdapter = createRawReporterAdapter(onEvent ? { onEvent } : undefined),
    prompter = createRawPrompter({ strict: true }),
    tabs,
    app,
    quiet = true,
    runPreChecks: shouldRunPreChecks = true,
    validateOutput = true,
    appName = 'sdk',
    version,
  } = options;

  const eventBus = createEventBus();
  const controller: ReporterAdapterController = reporterAdapter.start(eventBus);
  const reporter = createRootReporter(eventBus, appName, version);

  let closed = false;

  const invoke: SdkRuntime['invoke'] = async (command: any, input: any) => {
    if (closed) {
      throw new Error('SDK runtime is closed');
    }

    const contextDef = (command.context ?? {}) as ContextDef;
    const resolvedContext = resolveContextForSdk(contextDef, input.context as any);
    const extraArgs = Array.isArray(input.args) ? input.args : [];

    if (command.run) {
      const hookCtx = {
        ...(resolvedContext as Record<string, unknown>),
        extraArgs,
        cwd: input.cwd,
      };

      if (shouldRunPreChecks) {
        await runPreChecks(command, hookCtx as any, reporter);
      }

      const runCtx = {
        context: resolvedContext,
        globalContext: input.globalContext,
        extraArgs,
        cwd: input.cwd,
      };

      const runner = createRunner({
        cwd: input.cwd,
        context: resolvedContext as any,
        extraArgs,
        timeout: command.timeout,
        quiet,
        eventBus,
        tabs,
        app,
        prompter,
      });

      const result = await command.run(runner, runCtx);

      if (command.output && validateOutput) {
        const parsed = (command.output as z.ZodType).safeParse(result);
        if (!parsed.success) {
          throw new Error('Command output did not match output schema');
        }
        return parsed.data;
      }

      return result;
    }

    throw new Error('Cannot invoke a command without a run() implementation');
  };

  const close = () => {
    if (closed) return;
    closed = true;
    emitRootEnd(eventBus, 0);
    controller.stop();
  };

  return { invoke, close };
}
