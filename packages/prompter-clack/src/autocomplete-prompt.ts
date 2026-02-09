/**
 * Patched autocomplete function
 *
 * Copies the autocomplete function from @clack/prompts but uses a patched
 * AutocompletePrompt that wraps the cursor instead of clamping it.
 *
 * Upstream issue: https://github.com/bombshell-dev/clack/issues/XXX
 * TODO: Remove this file once the fix is released upstream
 */

import type { Key } from 'node:readline';
import { Prompt, type PromptOptions, settings } from '@clack/core';
import {
  isCancel,
  limitOptions,
  symbol,
  S_BAR,
  S_BAR_END,
  S_RADIO_ACTIVE,
  S_RADIO_INACTIVE,
} from '@clack/prompts';
import type { Writable } from 'node:stream';
import color from 'picocolors';

interface OptionLike {
  value: unknown;
  label?: string;
}

type FilterFunction<T extends OptionLike> = (search: string, opt: T) => boolean;

function getCursorForValue<T extends OptionLike>(
  selected: T['value'] | undefined,
  items: T[]
): number {
  if (selected === undefined || items.length === 0) {
    return 0;
  }
  const index = items.findIndex((item) => item.value === selected);
  return index !== -1 ? index : 0;
}

function defaultFilter<T extends OptionLike>(input: string, option: T): boolean {
  const label = option.label ?? String(option.value);
  return label.toLowerCase().includes(input.toLowerCase());
}

interface AutocompletePromptOptions<T extends OptionLike>
  extends PromptOptions<T['value'] | T['value'][], PatchedAutocompletePrompt<T>> {
  options: T[] | ((this: PatchedAutocompletePrompt<T>) => T[]);
  filter?: FilterFunction<T>;
  multiple?: boolean;
}

class PatchedAutocompletePrompt<T extends OptionLike> extends Prompt<
  T['value'] | T['value'][]
> {
  filteredOptions: T[];
  multiple: boolean;
  isNavigating = false;
  selectedValues: Array<T['value']> = [];
  focusedValue: T['value'] | undefined;
  #cursor = 0;
  #lastUserInput = '';
  #filterFn: FilterFunction<T>;
  #options: T[] | (() => T[]);

  get cursor(): number {
    return this.#cursor;
  }

  get userInputWithCursor() {
    if (!this.userInput) {
      return color.inverse(color.hidden('_'));
    }
    if (this._cursor >= this.userInput.length) {
      return `${this.userInput}█`;
    }
    const s1 = this.userInput.slice(0, this._cursor);
    const [s2, ...s3] = this.userInput.slice(this._cursor);
    return `${s1}${color.inverse(s2)}${s3.join('')}`;
  }

  get options(): T[] {
    if (typeof this.#options === 'function') {
      return this.#options();
    }
    return this.#options;
  }

  constructor(opts: AutocompletePromptOptions<T>) {
    super(opts);
    this.#options = opts.options;
    const options = this.options;
    this.filteredOptions = [...options];
    this.multiple = opts.multiple === true;
    this.#filterFn = opts.filter ?? defaultFilter;

    let initialValues: unknown[] | undefined;
    if (opts.initialValue && Array.isArray(opts.initialValue)) {
      initialValues = this.multiple
        ? opts.initialValue
        : opts.initialValue.slice(0, 1);
    } else if (!this.multiple && this.options.length > 0) {
      initialValues = [this.options[0].value];
    }

    if (initialValues) {
      for (const selectedValue of initialValues) {
        const selectedIndex = options.findIndex((opt) => opt.value === selectedValue);
        if (selectedIndex !== -1) {
          this.toggleSelected(selectedValue);
          this.#cursor = selectedIndex;
        }
      }
    }

    this.focusedValue = this.options[this.#cursor]?.value;
    this.on('key', (char, key) => this.#onKey(char, key));
    this.on('userInput', (value) => this.#onUserInputChanged(value));
  }

  protected override _isActionKey(char: string | undefined, key: Key): boolean {
    return (
      char === '\t' ||
      (this.multiple &&
        this.isNavigating &&
        key.name === 'space' &&
        char !== undefined &&
        char !== '')
    );
  }

  #onKey(_char: string | undefined, key: Key): void {
    const isUpKey = key.name === 'up';
    const isDownKey = key.name === 'down';
    const isReturnKey = key.name === 'return';

    if (isUpKey || isDownKey) {
      const length = this.filteredOptions.length;
      if (length > 0) {
        this.#cursor = ((this.#cursor + (isUpKey ? -1 : 1)) % length + length) % length;
      }
      this.focusedValue = this.filteredOptions[this.#cursor]?.value;
      if (!this.multiple) {
        this.selectedValues = [this.focusedValue];
      }
      this.isNavigating = true;
    } else if (isReturnKey) {
      this.value = this.multiple ? this.selectedValues : this.selectedValues[0];
    } else {
      if (this.multiple) {
        if (
          this.focusedValue !== undefined &&
          (key.name === 'tab' || (this.isNavigating && key.name === 'space'))
        ) {
          this.toggleSelected(this.focusedValue);
        } else {
          this.isNavigating = false;
        }
      } else {
        if (this.focusedValue) {
          this.selectedValues = [this.focusedValue];
        }
        this.isNavigating = false;
      }
    }
  }

  deselectAll() {
    this.selectedValues = [];
  }

  toggleSelected(value: T['value']) {
    if (this.filteredOptions.length === 0) return;
    if (this.multiple) {
      if (this.selectedValues.includes(value)) {
        this.selectedValues = this.selectedValues.filter((v) => v !== value);
      } else {
        this.selectedValues = [...this.selectedValues, value];
      }
    } else {
      this.selectedValues = [value];
    }
  }

  #onUserInputChanged(value: string): void {
    if (value !== this.#lastUserInput) {
      this.#lastUserInput = value;
      const options = this.options;
      this.filteredOptions = value
        ? options.filter((opt) => this.#filterFn(value, opt))
        : [...options];
      this.#cursor = getCursorForValue(this.focusedValue, this.filteredOptions);
      this.focusedValue = this.filteredOptions[this.#cursor]?.value;
      if (!this.multiple) {
        if (this.focusedValue !== undefined) {
          this.toggleSelected(this.focusedValue);
        } else {
          this.deselectAll();
        }
      }
    }
  }
}

interface Option<Value> {
  value: Value;
  label?: string;
  hint?: string;
}

function getLabel<T>(option: Option<T>) {
  return option.label ?? String(option.value ?? '');
}

function getFilteredOption<T>(searchText: string, option: Option<T>): boolean {
  if (!searchText) return true;
  const label = (option.label ?? String(option.value ?? '')).toLowerCase();
  const hint = (option.hint ?? '').toLowerCase();
  const value = String(option.value).toLowerCase();
  const term = searchText.toLowerCase();
  return label.includes(term) || hint.includes(term) || value.includes(term);
}

function getSelectedOptions<T>(values: T[], options: Option<T>[]): Option<T>[] {
  const results: Option<T>[] = [];
  for (const option of options) {
    if (values.includes(option.value)) {
      results.push(option);
    }
  }
  return results;
}

export interface AutocompleteOpts<Value> {
  message: string;
  options: Option<Value>[];
  maxItems?: number;
  placeholder?: string;
  initialValue?: Value;
  initialUserInput?: string;
  validate?: (value: Value | Value[] | undefined) => string | Error | undefined;
  filter?: (search: string, option: Option<Value>) => boolean;
  signal?: AbortSignal;
  input?: import('node:stream').Readable;
  output?: Writable;
}

export const patchedAutocomplete = <Value>(opts: AutocompleteOpts<Value>) => {
  const prompt = new PatchedAutocompletePrompt({
    options: opts.options,
    initialValue: opts.initialValue ? [opts.initialValue] : undefined,
    initialUserInput: opts.initialUserInput,
    filter:
      opts.filter ??
      ((search: string, opt: Option<Value>) => getFilteredOption(search, opt)),
    signal: opts.signal,
    input: opts.input,
    output: opts.output,
    validate: opts.validate,
    render() {
      const headings = [`${color.gray(S_BAR)}`, `${symbol(this.state)}  ${opts.message}`];
      const userInput = this.userInput;
      const options = this.options;
      const placeholder = opts.placeholder;
      const showPlaceholder = userInput === '' && placeholder !== undefined;

      switch (this.state) {
        case 'submit': {
          const selected = getSelectedOptions(this.selectedValues, options);
          const label =
            selected.length > 0 ? `  ${color.dim(selected.map(getLabel).join(', '))}` : '';
          return `${headings.join('\n')}\n${color.gray(S_BAR)}${label}`;
        }
        case 'cancel': {
          const userInputText = userInput
            ? `  ${color.strikethrough(color.dim(userInput))}`
            : '';
          return `${headings.join('\n')}\n${color.gray(S_BAR)}${userInputText}`;
        }
        default: {
          const barColor = this.state === 'error' ? color.yellow : color.cyan;
          const guidePrefix = `${barColor(S_BAR)}  `;
          const guidePrefixEnd = barColor(S_BAR_END);

          let searchText = '';
          if (this.isNavigating || showPlaceholder) {
            const searchTextValue = showPlaceholder ? placeholder : userInput;
            searchText = searchTextValue !== '' ? ` ${color.dim(searchTextValue)}` : '';
          } else {
            searchText = ` ${this.userInputWithCursor}`;
          }

          const matches =
            this.filteredOptions.length !== options.length
              ? color.dim(
                  ` (${this.filteredOptions.length} match${this.filteredOptions.length === 1 ? '' : 'es'})`
                )
              : '';

          const noResults =
            this.filteredOptions.length === 0 && userInput
              ? [`${guidePrefix}${color.yellow('No matches found')}`]
              : [];

          const validationError =
            this.state === 'error' ? [`${guidePrefix}${color.yellow(this.error)}`] : [];

          headings.push(`${guidePrefix.trimEnd()}`);
          headings.push(
            `${guidePrefix}${color.dim('Search:')}${searchText}${matches}`,
            ...noResults,
            ...validationError
          );

          const instructions = [
            `${color.dim('↑/↓')} to select`,
            `${color.dim('Enter:')} confirm`,
            `${color.dim('Type:')} to search`,
          ];

          const footers = [
            `${guidePrefix}${instructions.join(' • ')}`,
            guidePrefixEnd,
          ];

          const displayOptions =
            this.filteredOptions.length === 0
              ? []
              : limitOptions({
                  cursor: this.cursor,
                  options: this.filteredOptions,
                  columnPadding: 3,
                  rowPadding: headings.length + footers.length,
                  style: (option: Option<Value>, active: boolean) => {
                    const label = getLabel(option);
                    const hint =
                      option.hint && option.value === this.focusedValue
                        ? color.dim(` (${option.hint})`)
                        : '';
                    return active
                      ? `${color.green(S_RADIO_ACTIVE)} ${label}${hint}`
                      : `${color.dim(S_RADIO_INACTIVE)} ${color.dim(label)}${hint}`;
                  },
                  maxItems: opts.maxItems,
                  output: opts.output,
                });

          return [
            ...headings,
            ...displayOptions.map((option: string) => `${guidePrefix}${option}`),
            ...footers,
          ].join('\n');
        }
      }
    },
  });

  return prompt.prompt() as Promise<Value | symbol>;
};
