/**
 * Clack Prompter Implementation
 *
 * Implements the Prompter interface using @clack/prompts.
 */

import * as p from '@clack/prompts';
import type {
  Prompter,
  SelectOptions,
  MultiselectOptions,
  ConfirmOptions,
  TextOptions,
} from '@pokit/core';

/**
 * Create a Prompter using @clack/prompts
 */
export function createPrompter(): Prompter {
  return {
    async select<T>(options: SelectOptions<T>): Promise<T> {
      const result = await p.select({
        message: options.message,
        options: options.options as Parameters<typeof p.select<T>>[0]['options'],
        initialValue: options.initialValue,
      });

      if (p.isCancel(result)) {
        process.exit(0);
      }

      return result as T;
    },

    async multiselect<T>(options: MultiselectOptions<T>): Promise<T[]> {
      const result = await p.multiselect({
        message: options.message,
        options: options.options as Parameters<typeof p.multiselect<T>>[0]['options'],
        initialValues: options.initialValues,
        required: options.required,
      });

      if (p.isCancel(result)) {
        process.exit(0);
      }

      return result as T[];
    },

    async confirm(options: ConfirmOptions): Promise<boolean> {
      const result = await p.confirm({
        message: options.message,
        initialValue: options.initialValue,
      });

      if (p.isCancel(result)) {
        process.exit(0);
      }

      return result;
    },

    async text(options: TextOptions): Promise<string> {
      const result = await p.text({
        message: options.message,
        placeholder: options.placeholder,
        initialValue: options.initialValue,
        validate: options.validate,
      });

      if (p.isCancel(result)) {
        process.exit(0);
      }

      return result;
    },
  };
}
