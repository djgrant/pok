import { $ } from 'bun';

// =============================================================================
// Input Validation
// =============================================================================

/**
 * Valid characters for 1Password identifiers (vault, item, field names).
 * Allows alphanumeric, spaces, dashes, underscores, and periods.
 */
const VALID_IDENTIFIER_PATTERN = /^[a-zA-Z0-9 _.-]+$/;

/**
 * Validate a 1Password identifier (vault name, item name, or field name).
 * Throws if the identifier contains invalid characters.
 */
function validateIdentifier(value: string, type: 'vault' | 'item' | 'field'): void {
  if (!value || value.trim().length === 0) {
    throw new Error(`${type} name cannot be empty`);
  }
  if (!VALID_IDENTIFIER_PATTERN.test(value)) {
    throw new Error(
      `Invalid ${type} name: "${value}". Only alphanumeric characters, spaces, dashes, underscores, and periods are allowed.`
    );
  }
}

// =============================================================================
// Authentication
// =============================================================================

/**
 * Check if 1Password CLI is installed
 */
export async function isInstalled(): Promise<boolean> {
  const result = await $`which op`.nothrow().quiet();
  return result.exitCode === 0;
}

/**
 * Check if authenticated with 1Password CLI
 * Works for both desktop (app/signin) and CI (OP_SERVICE_ACCOUNT_TOKEN)
 */
export async function isAuthenticated(): Promise<boolean> {
  const result = await $`op whoami`.nothrow().quiet();
  return result.exitCode === 0;
}

/**
 * Get helpful error message for authentication failure
 */
export function getAuthErrorMessage(): string {
  if (process.env.OP_SERVICE_ACCOUNT_TOKEN) {
    return (
      '1Password authentication failed. ' +
      'The OP_SERVICE_ACCOUNT_TOKEN may be invalid or expired.'
    );
  }
  return (
    '1Password authentication failed. ' +
    'Either run `op signin` or ensure the 1Password app is running with CLI integration enabled.'
  );
}

/**
 * Check if a vault exists
 */
export async function vaultExists(vault: string): Promise<boolean> {
  validateIdentifier(vault, 'vault');
  const result = await $`op vault get ${vault} --format=json`.nothrow().quiet();
  return result.exitCode === 0;
}

/**
 * Create a vault
 */
export async function createVault(vault: string): Promise<void> {
  validateIdentifier(vault, 'vault');
  await $`op vault create ${vault}`.quiet();
}

/**
 * List all vaults
 */
export async function listVaults(): Promise<string[]> {
  const result = await $`op vault list --format=json`.quiet();
  const vaults = JSON.parse(result.text()) as Array<{ name: string }>;
  return vaults.map((v) => v.name);
}

/**
 * Item structure
 */
export interface OpItem {
  id: string;
  title: string;
  vault: { id: string; name: string };
  fields: Record<string, string>;
}

/**
 * Check if an item exists in a vault
 */
export async function itemExists(vault: string, item: string): Promise<boolean> {
  validateIdentifier(vault, 'vault');
  validateIdentifier(item, 'item');
  const result = await $`op item get ${item} --vault=${vault} --format=json`.nothrow().quiet();
  return result.exitCode === 0;
}

/**
 * Get a field value from a 1Password item
 */
export async function getField(vault: string, item: string, field: string): Promise<string | null> {
  validateIdentifier(vault, 'vault');
  validateIdentifier(item, 'item');
  validateIdentifier(field, 'field');
  return resolveSecret(`op://${vault}/${item}/${field}`);
}

/**
 * Get all fields from a 1Password item
 */
export async function getItem(vault: string, item: string): Promise<OpItem | null> {
  validateIdentifier(vault, 'vault');
  validateIdentifier(item, 'item');
  const result = await $`op item get ${item} --vault=${vault} --format=json`.nothrow().quiet();

  if (result.exitCode !== 0) {
    return null;
  }

  const data = JSON.parse(result.text()) as {
    id: string;
    title: string;
    vault: { id: string; name: string };
    fields: Array<{ label: string; value?: string }>;
  };

  const fields: Record<string, string> = {};
  for (const f of data.fields) {
    if (f.value) {
      fields[f.label] = f.value;
    }
  }

  return {
    id: data.id,
    title: data.title,
    vault: data.vault,
    fields,
  };
}

/**
 * Get multiple items from a vault in a single batch
 * More efficient than calling getItem multiple times
 */
export async function getItemsBatch(
  vault: string,
  itemNames: string[]
): Promise<Map<string, OpItem>> {
  validateIdentifier(vault, 'vault');
  for (const itemName of itemNames) {
    validateIdentifier(itemName, 'item');
  }

  const results = new Map<string, OpItem>();

  // Fetch items in parallel
  await Promise.all(
    itemNames.map(async (itemName) => {
      const item = await getItem(vault, itemName);
      if (item) {
        results.set(itemName, item);
      }
    })
  );

  return results;
}

/**
 * Set a field on a 1Password item, creating the item if it doesn't exist
 */
export async function setField(
  vault: string,
  item: string,
  field: string,
  value: string
): Promise<void> {
  return setFieldsBatch(vault, item, { [field]: value });
}

/**
 * Set multiple fields on a 1Password item in a single operation.
 * Batches all field updates into a single CLI call for efficiency.
 */
export async function setFieldsBatch(
  vault: string,
  item: string,
  fields: Record<string, string>
): Promise<void> {
  validateIdentifier(vault, 'vault');
  validateIdentifier(item, 'item');
  for (const fieldName of Object.keys(fields)) {
    validateIdentifier(fieldName, 'field');
  }

  const exists = await itemExists(vault, item);

  // Build field arguments for all fields
  const fieldArgs = Object.entries(fields).map(
    ([fieldName, fieldValue]) => `${fieldName}[concealed]=${fieldValue}`
  );

  if (exists) {
    // Update existing item - edit all fields in a single command
    await $`op item edit ${item} --vault=${vault} ${fieldArgs}`.quiet();
  } else {
    // Create new item with all fields
    await $`op item create --category=login --vault=${vault} --title=${item} ${fieldArgs}`.quiet();
  }
}

/**
 * Resolve a secret reference (op://vault/item/field)
 */
export async function resolveSecret(reference: string): Promise<string | null> {
  const result = await $`op read ${reference}`.nothrow().quiet();
  if (result.exitCode !== 0) {
    return null;
  }
  return result.text().trim();
}
