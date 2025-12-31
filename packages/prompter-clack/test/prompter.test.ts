import { describe, it, expect } from 'bun:test';
import { createPrompter } from '@pokit/prompter-clack';

// =============================================================================
// Note: Testing the prompter-clack implementation is challenging because:
// 1. @clack/prompts exports are readonly and cannot be mocked
// 2. The prompts require actual TTY interaction
//
// These tests focus on the structure and behavior we can verify without
// mocking the underlying clack/prompts library. For full integration testing,
// the existing integration tests in test/core/ cover prompt behavior via
// the createRawPrompter utility.
// =============================================================================

// =============================================================================
// createPrompter Tests
// =============================================================================

describe('createPrompter', () => {
  it('returns object with all required prompter methods', () => {
    const prompter = createPrompter();

    expect(typeof prompter.select).toBe('function');
    expect(typeof prompter.multiselect).toBe('function');
    expect(typeof prompter.confirm).toBe('function');
    expect(typeof prompter.text).toBe('function');
  });

  it('returns a valid Prompter interface', () => {
    const prompter = createPrompter();

    // Verify the shape matches what we expect
    expect(prompter).toHaveProperty('select');
    expect(prompter).toHaveProperty('multiselect');
    expect(prompter).toHaveProperty('confirm');
    expect(prompter).toHaveProperty('text');
  });

  it('creates independent prompter instances', () => {
    const prompter1 = createPrompter();
    const prompter2 = createPrompter();

    // Each call should return a new instance
    expect(prompter1).not.toBe(prompter2);
  });
});

// =============================================================================
// Method Signature Tests
// These verify the methods accept the expected parameters without actually
// calling the underlying clack/prompts functions
// =============================================================================

describe('prompter method signatures', () => {
  const prompter = createPrompter();

  describe('select method', () => {
    it('is callable with correct options shape', () => {
      // Verify the function exists and has the right signature
      // We can't actually call it without a TTY
      expect(typeof prompter.select).toBe('function');
      expect(prompter.select.length).toBe(1); // Takes 1 argument (options)
    });
  });

  describe('multiselect method', () => {
    it('is callable with correct options shape', () => {
      expect(typeof prompter.multiselect).toBe('function');
      expect(prompter.multiselect.length).toBe(1);
    });
  });

  describe('confirm method', () => {
    it('is callable with correct options shape', () => {
      expect(typeof prompter.confirm).toBe('function');
      expect(prompter.confirm.length).toBe(1);
    });
  });

  describe('text method', () => {
    it('is callable with correct options shape', () => {
      expect(typeof prompter.text).toBe('function');
      expect(prompter.text.length).toBe(1);
    });
  });
});

// =============================================================================
// Type Compatibility Tests
// Verify that the prompter satisfies the Prompter interface from @pokit/core
// =============================================================================

describe('type compatibility', () => {
  it('prompter satisfies Prompter interface shape', () => {
    const prompter = createPrompter();

    // These type checks happen at compile time
    // At runtime, we just verify the methods exist
    const methods = ['select', 'multiselect', 'confirm', 'text'];

    for (const method of methods) {
      expect(prompter).toHaveProperty(method);
      expect(typeof (prompter as any)[method]).toBe('function');
    }
  });
});
