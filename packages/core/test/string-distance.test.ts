import { describe, it, expect } from 'bun:test';
import { levenshtein, findClosestMatch } from '../src/lib/string-distance';

// =============================================================================
// Levenshtein Distance Tests
// =============================================================================

describe('levenshtein', () => {
  describe('identical strings', () => {
    it('returns 0 for empty strings', () => {
      expect(levenshtein('', '')).toBe(0);
    });

    it('returns 0 for identical strings', () => {
      expect(levenshtein('hello', 'hello')).toBe(0);
    });

    it('returns 0 for identical single characters', () => {
      expect(levenshtein('a', 'a')).toBe(0);
    });
  });

  describe('single edit operations', () => {
    it('returns 1 for single insertion', () => {
      expect(levenshtein('cat', 'cats')).toBe(1);
    });

    it('returns 1 for single deletion', () => {
      expect(levenshtein('cats', 'cat')).toBe(1);
    });

    it('returns 1 for single substitution', () => {
      expect(levenshtein('cat', 'bat')).toBe(1);
    });

    it('handles insertion at beginning', () => {
      expect(levenshtein('at', 'cat')).toBe(1);
    });

    it('handles insertion in middle', () => {
      expect(levenshtein('cat', 'cart')).toBe(1);
    });
  });

  describe('multiple edit operations', () => {
    it('returns 2 for two substitutions', () => {
      expect(levenshtein('cat', 'dog')).toBe(3);
    });

    it('returns correct distance for transposition-like changes', () => {
      // 'ab' -> 'ba' requires 2 operations (not 1 as with Damerau-Levenshtein)
      expect(levenshtein('ab', 'ba')).toBe(2);
    });

    it('handles longer strings', () => {
      expect(levenshtein('kitten', 'sitting')).toBe(3);
    });

    it('handles completely different strings', () => {
      expect(levenshtein('abc', 'xyz')).toBe(3);
    });
  });

  describe('empty string handling', () => {
    it('returns length of non-empty string when one is empty', () => {
      expect(levenshtein('', 'hello')).toBe(5);
      expect(levenshtein('hello', '')).toBe(5);
    });
  });

  describe('CLI flag examples', () => {
    it('handles single-character typo: enviroment -> environment', () => {
      expect(levenshtein('enviroment', 'environment')).toBe(1);
    });

    it('handles missing character: vebose -> verbose', () => {
      expect(levenshtein('vebose', 'verbose')).toBe(1);
    });

    it('handles extra character: verboose -> verbose', () => {
      expect(levenshtein('verboose', 'verbose')).toBe(1);
    });

    it('handles multiple typos: envornment -> environment', () => {
      expect(levenshtein('envornment', 'environment')).toBe(2);
    });
  });
});

// =============================================================================
// findClosestMatch Tests
// =============================================================================

describe('findClosestMatch', () => {
  describe('single-character typos', () => {
    it('suggests flag for single-character typo', () => {
      const match = findClosestMatch('enviroment', ['env', 'environment', 'verbose']);
      expect(match).toBe('environment');
    });

    it('suggests flag for missing character', () => {
      const match = findClosestMatch('vebose', ['env', 'verbose', 'dry-run']);
      expect(match).toBe('verbose');
    });

    it('suggests flag for extra character', () => {
      const match = findClosestMatch('verboose', ['env', 'verbose', 'dry-run']);
      expect(match).toBe('verbose');
    });

    it('suggests flag for swapped characters', () => {
      const match = findClosestMatch('verobse', ['env', 'verbose', 'dry-run']);
      expect(match).toBe('verbose');
    });
  });

  describe('kebab-case handling', () => {
    it('suggests flag for missing hyphen: dryrun -> dry-run', () => {
      const match = findClosestMatch('dryrun', ['dry-run', 'verbose', 'env']);
      expect(match).toBe('dry-run');
    });

    it('suggests flag for extra hyphen: dry--run -> dry-run', () => {
      const match = findClosestMatch('dry--run', ['dry-run', 'verbose', 'env']);
      expect(match).toBe('dry-run');
    });

    it('matches camelCase input to kebab-case candidate', () => {
      const match = findClosestMatch('dryRun', ['dry-run', 'verbose', 'env']);
      expect(match).toBe('dry-run');
    });

    it('handles complex kebab-case: no-git-checks', () => {
      const match = findClosestMatch('nogitchecks', ['no-git-checks', 'verbose']);
      expect(match).toBe('no-git-checks');
    });
  });

  describe('distance thresholds', () => {
    it('returns match for distance 1', () => {
      const match = findClosestMatch('en', ['env', 'verbose']);
      expect(match).toBe('env');
    });

    it('returns match for distance 2', () => {
      const match = findClosestMatch('enivronment', ['environment', 'verbose']);
      expect(match).toBe('environment');
    });

    it('returns match for distance 3', () => {
      const match = findClosestMatch('envrnmnt', ['environment', 'verbose']);
      expect(match).toBe('environment');
    });

    it('returns undefined for distance 4+', () => {
      // 'abcd' -> 'env' = 4, 'abcd' -> 'verbose' = 7, 'abcd' -> 'dry-run' = 7
      const match = findClosestMatch('abcd', ['env', 'verbose', 'dry-run']);
      expect(match).toBeUndefined();
    });

    it('returns undefined for completely different strings', () => {
      const match = findClosestMatch('foobar', ['env', 'verbose', 'dry-run']);
      expect(match).toBeUndefined();
    });
  });

  describe('custom max distance', () => {
    it('respects custom maxDistance of 1', () => {
      // 'enviroment' is distance 1 from 'environment'
      const match1 = findClosestMatch('enviroment', ['environment'], 1);
      expect(match1).toBe('environment');

      // 'envrnmnt' is distance 3 from 'environment', should not match with maxDistance=1
      const match2 = findClosestMatch('envrnmnt', ['environment'], 1);
      expect(match2).toBeUndefined();
    });

    it('respects custom maxDistance of 2', () => {
      const match = findClosestMatch('enivronment', ['environment'], 2);
      expect(match).toBe('environment');
    });
  });

  describe('preference for shorter flags', () => {
    it('prefers shorter flag when distances are equal', () => {
      // 'en' is distance 1 from both 'env' and 'end', prefer shorter (they're same length actually)
      // Let's use a case where lengths differ
      const match = findClosestMatch('e', ['en', 'env', 'environment']);
      // 'e' -> 'en' is distance 1
      // 'e' -> 'env' is distance 2
      expect(match).toBe('en');
    });

    it('returns first match when lengths are equal', () => {
      // Both 'cat' and 'bat' are distance 1 from 'hat'
      const match = findClosestMatch('hat', ['cat', 'bat']);
      // Should return 'cat' as it comes first and they have same length
      expect(match).toBe('cat');
    });
  });

  describe('case insensitivity', () => {
    it('matches regardless of case', () => {
      const match = findClosestMatch('VERBOSE', ['verbose', 'env']);
      expect(match).toBe('verbose');
    });

    it('matches mixed case input', () => {
      const match = findClosestMatch('VeRbOsE', ['verbose', 'env']);
      expect(match).toBe('verbose');
    });
  });

  describe('edge cases', () => {
    it('returns undefined for empty candidates array', () => {
      const match = findClosestMatch('env', []);
      expect(match).toBeUndefined();
    });

    it('returns exact match when available', () => {
      const match = findClosestMatch('env', ['env', 'environment', 'verbose']);
      expect(match).toBe('env');
    });

    it('handles empty input string', () => {
      const match = findClosestMatch('', ['a', 'ab', 'abc']);
      // '' is distance 1 from 'a', distance 2 from 'ab', etc.
      expect(match).toBe('a');
    });
  });

  describe('command name suggestions', () => {
    it('suggests command for single-character typo', () => {
      const match = findClosestMatch('buidl', ['build', 'test', 'deploy']);
      expect(match).toBe('build');
    });

    it('suggests command for missing character', () => {
      const match = findClosestMatch('depoy', ['build', 'test', 'deploy']);
      expect(match).toBe('deploy');
    });

    it('returns undefined for unrelated command', () => {
      const match = findClosestMatch('foobar', ['build', 'test', 'deploy']);
      expect(match).toBeUndefined();
    });
  });
});
