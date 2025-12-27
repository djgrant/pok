---
title: Command Composition
order: 3
category: core-concepts
---

# Command Composition

Pok lets you compose commands into parent-child hierarchies and run multiple commands together. This helps organize complex CLIs.

## What You'll Learn

- How to create nested commands
- How to run commands in sequence
- Using pre-conditions to chain commands

## Step 1: Create a parent command with children

Let's create a `db` command with `migrate` and `seed` subcommands:

```bash
cat > commands/db.ts << 'EOF'
import { defineCommand } from '@openpok/core';

export default defineCommand({
  meta: {
    name: 'db',
    description: 'Database operations',
  },
  run: () => {
    console.log('Available subcommands: migrate, seed');
    console.log('Run: pok db migrate  or  pok db seed');
  },
});
EOF
```

## Step 2: Create child commands

```bash
cat > commands/db.migrate.ts << 'EOF'
import { defineCommand } from '@openpok/core';

export default defineCommand({
  meta: {
    name: 'db.migrate',
    description: 'Run database migrations',
  },
  run: () => {
    console.log('Running migrations...');
    console.log('Migration 001: Create users table - done');
    console.log('Migration 002: Create posts table - done');
    console.log('All migrations complete!');
  },
});
EOF
```

```bash
cat > commands/db.seed.ts << 'EOF'
import { defineCommand } from '@openpok/core';

export default defineCommand({
  meta: {
    name: 'db.seed',
    description: 'Seed the database with test data',
  },
  run: () => {
    console.log('Seeding database...');
    console.log('Created 10 users');
    console.log('Created 50 posts');
    console.log('Seeding complete!');
  },
});
EOF
```

## Step 3: Run the commands

Run the parent command:

```bash
pok db
```

Run child commands:

```bash
pok db migrate
```

```bash
pok db seed
```

## Step 4: Chain commands with pre-conditions

Create a setup command that runs migrate before seed:

```bash
cat > commands/db.setup.ts << 'EOF'
import { defineCommand } from '@openpok/core';

export default defineCommand({
  meta: {
    name: 'db.setup',
    description: 'Full database setup (migrate + seed)',
  },
  pre: [
    { command: 'db.migrate' },
  ],
  run: async ({ commands }) => {
    console.log('Running post-migration seed...');
    await commands['db.seed']();
    console.log('Database setup complete!');
  },
});
EOF
```

```bash
pok db setup
```

## Command Naming Convention

Use dots to create hierarchy:

```
commands/
  deploy.ts              # pok deploy
  deploy.frontend.ts     # pok deploy frontend
  deploy.backend.ts      # pok deploy backend
  deploy.all.ts          # pok deploy all
```

## Running Other Commands

From within a command, you can run other commands:

```typescript
run: async ({ commands }) => {
  await commands['other-command']({ someArg: 'value' });
}
```

## Key Points

- Use dot notation for parent-child relationships
- Child commands are separate files: `parent.child.ts`
- Use `pre` to run commands before the main command
- Access other commands via the `commands` parameter
- Composition keeps complex CLIs organized
