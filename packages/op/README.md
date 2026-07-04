# @pokit/op

Operation utilities for pok CLI applications — helpers for defining 1Password-backed secret vaults and resolvers, plus low-level 1Password CLI utilities.

## Install

```bash
bun add @pokit/op
```

## Usage

Define a typed vault of 1Password references, then a resolver that maps environments to vault items:

```ts
import { defineOpVault, defineOpResolver } from '@pokit/op';

const vault = defineOpVault({
  DATABASE_URL: 'MyItem:database-url',
  API_KEY: 'MyItem:api-key',
});

const resolver = defineOpResolver({
  vault,
  envs: ['dev', 'staging', 'prod'],
  // ...environment-specific config
});
```

You can also use the lower-level 1Password CLI utilities directly via the `opUtils` namespace:

```ts
import { opUtils } from '@pokit/op';

const installed = await opUtils.isInstalled();
const authenticated = await opUtils.isAuthenticated();
const value = await opUtils.getField('MyVault', 'MyItem', 'password');
```

`opInstalled` and `opAuthenticated` are also exported as ready-made `defineCheck(...)` checks for use in a pok command tree.
