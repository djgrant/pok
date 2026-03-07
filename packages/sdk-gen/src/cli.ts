import { generateSdk } from './main';
import type { GenerateSdkOptions, ImportExtensionMode } from './main';

export function usage(): string {
  return 'pok-sdk generate [--config <path>] [--out <path>] [--import-extension <preserve|ts|js>] [--include-pm <true|false>]';
}

function parseBool(v: string | undefined, defaultValue: boolean): boolean {
  if (v === undefined) return defaultValue;
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  throw new Error(`Invalid boolean: ${v}`);
}

function parseArgs(argv: string[]): { cmd: string | null; opts: GenerateSdkOptions; help: boolean } {
  const cmd = argv[0] ?? null;
  const opts: GenerateSdkOptions = {};
  let help = cmd === '--help' || cmd === '-h';

  for (let i = 1; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--config') {
      opts.config = argv[++i];
      continue;
    }
    if (a === '--out') {
      opts.out = argv[++i];
      continue;
    }
    if (a === '--import-extension') {
      const v = argv[++i] as ImportExtensionMode | undefined;
      if (v !== 'preserve' && v !== 'ts' && v !== 'js') {
        throw new Error(`Invalid --import-extension: ${String(v)}`);
      }
      opts.importExtension = v;
      continue;
    }
    if (a === '--include-pm') {
      opts.includePm = parseBool(argv[++i], true);
      continue;
    }
    if (a === '--help' || a === '-h') {
      help = true;
      continue;
    }

    throw new Error(`Unknown arg: ${a}`);
  }

  return { cmd, opts, help };
}

export async function runCli(argv: string[]): Promise<number> {
  try {
    const { cmd, opts, help } = parseArgs(argv);

    if (help || cmd !== 'generate') {
      console.log(usage());
      return help ? 0 : 1;
    }

    const result = await generateSdk(opts);
    console.log(`Generated SDK: ${result.outPath}`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 1;
  }
}
