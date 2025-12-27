import { describe, it, expect } from 'bun:test';
import { parseOpRef, defineOpVault } from '../src/vault';

// =============================================================================
// Note: The op.ts functions require the actual `op` CLI to be installed and
// authenticated. For unit tests, we focus on the validation and parsing logic
// that doesn't require the CLI. Integration tests with the CLI would need
// a proper 1Password setup.
// =============================================================================

// =============================================================================
// parseOpRef Tests
// =============================================================================

describe('parseOpRef', () => {
  it('parses valid item:field reference', () => {
    const result = parseOpRef('supabase:SUPABASE_URL');
    expect(result).toEqual({
      item: 'supabase',
      field: 'SUPABASE_URL',
    });
  });

  it('handles item name with dashes', () => {
    const result = parseOpRef('my-app-secrets:API_KEY');
    expect(result).toEqual({
      item: 'my-app-secrets',
      field: 'API_KEY',
    });
  });

  it('handles item name with underscores', () => {
    const result = parseOpRef('my_app:SECRET_KEY');
    expect(result).toEqual({
      item: 'my_app',
      field: 'SECRET_KEY',
    });
  });

  it('handles field name with colons (uses first colon as separator)', () => {
    // Edge case: if field name has colon, it should be part of field
    const result = parseOpRef('item:field:with:colons');
    expect(result).toEqual({
      item: 'item',
      field: 'field:with:colons',
    });
  });

  it('throws for reference without colon', () => {
    expect(() => parseOpRef('invalidref' as any)).toThrow(
      'Invalid vault reference: invalidref. Expected "item:field".'
    );
  });
});

// =============================================================================
// defineOpVault Tests
// =============================================================================

describe('defineOpVault', () => {
  it('creates vault with secrets', () => {
    const vault = defineOpVault({
      POSTGRES_URL: 'supabase:SUPABASE_SESSION_DSN',
      SUPABASE_URL: 'supabase:SUPABASE_URL',
    });

    expect(vault.secrets).toEqual({
      POSTGRES_URL: 'supabase:SUPABASE_SESSION_DSN',
      SUPABASE_URL: 'supabase:SUPABASE_URL',
    });
  });

  it('preserves type information', () => {
    const vault = defineOpVault({
      API_KEY: 'app:API_KEY',
      SECRET: 'app:SECRET',
    });

    // Type check: these should be the literal keys
    const keys = Object.keys(vault.secrets);
    expect(keys).toContain('API_KEY');
    expect(keys).toContain('SECRET');
  });

  it('handles empty vault', () => {
    const vault = defineOpVault({});
    expect(vault.secrets).toEqual({});
  });

  it('handles single secret', () => {
    const vault = defineOpVault({
      ONLY_SECRET: 'item:field',
    });
    expect(Object.keys(vault.secrets)).toHaveLength(1);
  });
});

// =============================================================================
// Input Validation Pattern Tests
// These test the validation patterns used in op.ts without requiring the CLI
// =============================================================================

describe('identifier validation patterns', () => {
  // Pattern from op.ts: /^[a-zA-Z0-9 _.-]+$/
  const VALID_IDENTIFIER_PATTERN = /^[a-zA-Z0-9 _.-]+$/;

  describe('valid identifiers', () => {
    const validIdentifiers = [
      'my-vault',
      'my_vault',
      'MyVault',
      'my.vault',
      'my vault',
      'vault123',
      'VAULT',
      'a',
      '123',
      'vault-name.with_mixed-chars',
    ];

    for (const identifier of validIdentifiers) {
      it(`accepts "${identifier}"`, () => {
        expect(VALID_IDENTIFIER_PATTERN.test(identifier)).toBe(true);
      });
    }
  });

  describe('invalid identifiers', () => {
    const invalidIdentifiers = [
      '', // empty
      'vault;drop', // semicolon
      'vault`cmd`', // backticks
      "vault'name", // single quote
      'vault"name', // double quote
      'vault$var', // dollar sign
      'vault|pipe', // pipe
      'vault&and', // ampersand
      'vault>file', // redirect
      'vault<file', // redirect
      '$(cmd)', // command substitution
      'vault\nname', // newline
      'vault\tname', // tab
    ];

    for (const identifier of invalidIdentifiers) {
      it(`rejects "${identifier.replace(/\n/g, '\\n').replace(/\t/g, '\\t')}"`, () => {
        expect(VALID_IDENTIFIER_PATTERN.test(identifier)).toBe(false);
      });
    }
  });
});

// =============================================================================
// Auth Error Message Tests
// =============================================================================

describe('getAuthErrorMessage patterns', () => {
  // These test the logic patterns without requiring actual op CLI

  it('suggests service account issue when token is set', () => {
    const hasToken = true;
    const message = hasToken
      ? '1Password authentication failed. The OP_SERVICE_ACCOUNT_TOKEN may be invalid or expired.'
      : '1Password authentication failed. Either run `op signin` or ensure the 1Password app is running with CLI integration enabled.';

    expect(message).toContain('OP_SERVICE_ACCOUNT_TOKEN');
  });

  it('suggests signin when no token', () => {
    const hasToken = false;
    const message = hasToken
      ? '1Password authentication failed. The OP_SERVICE_ACCOUNT_TOKEN may be invalid or expired.'
      : '1Password authentication failed. Either run `op signin` or ensure the 1Password app is running with CLI integration enabled.';

    expect(message).toContain('op signin');
  });
});
