/**
 * Raw Prompter Implementation
 *
 * A non-interactive prompter for testing and non-TTY environments.
 * Pre-configure responses or use defaults - no user input required.
 */

import type {
  Prompter,
  SelectOptions,
  MultiselectOptions,
  ConfirmOptions,
  TextOptions,
} from './types';

/**
 * Recorded prompt call for assertions
 */
export type PromptCall =
  | { type: 'select'; options: SelectOptions<unknown>; response: unknown }
  | {
      type: 'multiselect';
      options: MultiselectOptions<unknown>;
      response: unknown[];
    }
  | { type: 'confirm'; options: ConfirmOptions; response: boolean }
  | { type: 'text'; options: TextOptions; response: string };

/**
 * Response provider - can be a static value or a function
 */
export type ResponseProvider<T> = T | ((options: unknown) => T);

/**
 * Options for the raw prompter
 */
export type RawPrompterOptions = {
  /**
   * Responses for select prompts.
   * Can be a single value (used for all), an array (consumed in order),
   * or a function that receives the options and returns a value.
   */
  selectResponses?: ResponseProvider<unknown> | ResponseProvider<unknown>[];

  /**
   * Responses for multiselect prompts.
   * Can be a single value (used for all), an array (consumed in order),
   * or a function that receives the options and returns an array of values.
   */
  multiselectResponses?:
    | ResponseProvider<unknown[]>
    | ResponseProvider<unknown[]>[];

  /**
   * Responses for confirm prompts.
   * Can be a single value (used for all), an array (consumed in order),
   * or a function that receives the options and returns a value.
   * Defaults to true.
   */
  confirmResponses?: ResponseProvider<boolean> | ResponseProvider<boolean>[];

  /**
   * Responses for text prompts.
   * Can be a single value (used for all), an array (consumed in order),
   * or a function that receives the options and returns a value.
   * Defaults to empty string or initialValue if provided.
   */
  textResponses?: ResponseProvider<string> | ResponseProvider<string>[];

  /**
   * Called when a prompt is made. Useful for debugging or streaming assertions.
   */
  onPrompt?: (call: PromptCall) => void;

  /**
   * If true, throw an error when no response is configured for a prompt.
   * If false (default), use sensible defaults.
   */
  strict?: boolean;
};

/**
 * Extended prompter with call tracking
 */
export interface RawPrompter extends Prompter {
  /** Get all recorded prompt calls */
  getCalls(): PromptCall[];
  /** Clear recorded calls */
  clearCalls(): void;
}

/**
 * Create a raw prompter for testing and non-TTY environments
 *
 * @example
 * ```ts
 * // Simple usage with defaults
 * const prompter = createRawPrompter();
 *
 * // Pre-configured responses
 * const prompter = createRawPrompter({
 *   selectResponses: ['option1', 'option2'],  // consumed in order
 *   confirmResponses: true,                    // always true
 *   textResponses: (opts) => opts.initialValue ?? 'test',
 * });
 *
 * // Assert on prompts
 * const calls = prompter.getCalls();
 * expect(calls[0]).toMatchObject({ type: 'select', response: 'option1' });
 * ```
 */
export function createRawPrompter(
  options: RawPrompterOptions = {}
): RawPrompter {
  const calls: PromptCall[] = [];

  // Track indices for array responses
  let selectIndex = 0;
  let multiselectIndex = 0;
  let confirmIndex = 0;
  let textIndex = 0;

  function getResponse<T>(
    responses: ResponseProvider<T> | ResponseProvider<T>[] | undefined,
    index: number,
    promptOptions: unknown,
    defaultValue: T
  ): T {
    if (responses === undefined) {
      if (options.strict) {
        throw new Error('No response configured for prompt (strict mode)');
      }
      return defaultValue;
    }

    // Array of responses - consume in order
    if (Array.isArray(responses)) {
      if (index >= responses.length) {
        if (options.strict) {
          throw new Error(
            `No more responses available (consumed ${responses.length}, requested index ${index})`
          );
        }
        // Repeat last response if exhausted
        const lastResponse = responses[responses.length - 1];
        return typeof lastResponse === 'function'
          ? (lastResponse as (options: unknown) => T)(promptOptions)
          : (lastResponse as T);
      }
      const response = responses[index];
      return typeof response === 'function'
        ? (response as (options: unknown) => T)(promptOptions)
        : (response as T);
    }

    // Single response (function or value)
    return typeof responses === 'function'
      ? (responses as (options: unknown) => T)(promptOptions)
      : (responses as T);
  }

  return {
    async select<T>(selectOptions: SelectOptions<T>): Promise<T> {
      // Default: return first option's value, or initialValue
      const defaultValue =
        selectOptions.initialValue ?? selectOptions.options[0]?.value;

      const response = getResponse(
        options.selectResponses,
        selectIndex++,
        selectOptions,
        defaultValue
      ) as T;

      const call: PromptCall = {
        type: 'select',
        options: selectOptions as SelectOptions<unknown>,
        response,
      };
      calls.push(call);
      options.onPrompt?.(call);

      return response;
    },

    async multiselect<T>(multiselectOptions: MultiselectOptions<T>): Promise<T[]> {
      // Default: return initialValues, or all options if required, or empty array
      const defaultValue =
        multiselectOptions.initialValues ??
        (multiselectOptions.required
          ? multiselectOptions.options.map((o) => o.value)
          : []);

      const response = getResponse(
        options.multiselectResponses,
        multiselectIndex++,
        multiselectOptions,
        defaultValue
      ) as T[];

      const call: PromptCall = {
        type: 'multiselect',
        options: multiselectOptions as MultiselectOptions<unknown>,
        response,
      };
      calls.push(call);
      options.onPrompt?.(call);

      return response;
    },

    async confirm(confirmOptions: ConfirmOptions): Promise<boolean> {
      // Default: true, or initialValue if provided
      const defaultValue = confirmOptions.initialValue ?? true;

      const response = getResponse(
        options.confirmResponses,
        confirmIndex++,
        confirmOptions,
        defaultValue
      );

      const call: PromptCall = {
        type: 'confirm',
        options: confirmOptions,
        response,
      };
      calls.push(call);
      options.onPrompt?.(call);

      return response;
    },

    async text(textOptions: TextOptions): Promise<string> {
      // Default: initialValue or empty string
      const defaultValue = textOptions.initialValue ?? '';

      const response = getResponse(
        options.textResponses,
        textIndex++,
        textOptions,
        defaultValue
      );

      const call: PromptCall = { type: 'text', options: textOptions, response };
      calls.push(call);
      options.onPrompt?.(call);

      return response;
    },

    getCalls(): PromptCall[] {
      return calls;
    },

    clearCalls(): void {
      calls.length = 0;
      selectIndex = 0;
      multiselectIndex = 0;
      confirmIndex = 0;
      textIndex = 0;
    },
  };
}
