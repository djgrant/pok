import type { ApprovalRequestBody } from './types';

/**
 * A standing grant (protocol v1.2): "allow this and equivalent requests for a
 * while". In-memory only — grants live for the daemon's lifetime at most.
 */
export interface StandingGrant {
  repo: string;
  /** The approved request's `context.env` value; may be undefined. */
  contextEnv: unknown;
  keys: string[];
  access: 'read' | 'write';
  /** Epoch milliseconds. */
  expiresAt: number;
}

export interface GrantStore {
  /**
   * Return a grant covering the request, or null. A grant covers a request
   * when the repo, `context.env` value (both undefined counts as same) and
   * access level all match, the requested keys are a subset of the granted
   * keys, and the grant has not expired. Expired grants are pruned lazily.
   */
  check(request: ApprovalRequestBody): StandingGrant | null;
  /** Store a grant derived from an approved request. */
  add(request: ApprovalRequestBody, ttlSeconds: number): StandingGrant;
}

function accessOf(request: ApprovalRequestBody): 'read' | 'write' {
  return request.access ?? 'read';
}

function envOf(request: ApprovalRequestBody): unknown {
  return request.context ? request.context['env'] : undefined;
}

export function createGrantStore(now: () => number = Date.now): GrantStore {
  const grants: StandingGrant[] = [];

  const prune = () => {
    const t = now();
    for (let i = grants.length - 1; i >= 0; i--) {
      if (grants[i]!.expiresAt <= t) grants.splice(i, 1);
    }
  };

  return {
    check(request) {
      prune();
      const access = accessOf(request);
      const env = envOf(request);
      return (
        grants.find(
          (grant) =>
            grant.repo === request.repo &&
            grant.contextEnv === env &&
            grant.access === access &&
            request.keys.every((key) => grant.keys.includes(key)),
        ) ?? null
      );
    },

    add(request, ttlSeconds) {
      const grant: StandingGrant = {
        repo: request.repo,
        contextEnv: envOf(request),
        keys: [...request.keys],
        access: accessOf(request),
        expiresAt: now() + ttlSeconds * 1000,
      };
      grants.push(grant);
      return grant;
    },
  };
}
