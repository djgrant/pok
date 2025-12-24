/**
 * String distance utilities for typo detection and suggestions
 *
 * Uses Levenshtein edit distance to find the closest match
 * for misspelled flags and commands.
 */

/**
 * Calculate Levenshtein edit distance between two strings
 *
 * The Levenshtein distance is the minimum number of single-character edits
 * (insertions, deletions, or substitutions) required to change one string
 * into the other.
 *
 * @param a - First string
 * @param b - Second string
 * @returns The edit distance between the two strings
 */
export function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1, // substitution
          matrix[i]![j - 1]! + 1, // insertion
          matrix[i - 1]![j]! + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length]![a.length]!;
}

/**
 * Normalize a flag name for comparison
 *
 * Handles kebab-case variations by removing hyphens and lowercasing.
 * This allows matching `--dry-run` with `--dryrun`.
 *
 * @param flag - The flag name to normalize
 * @returns Normalized flag name
 */
function normalizeFlag(flag: string): string {
  return flag.toLowerCase().replace(/-/g, '');
}

/**
 * Calculate the distance between two strings with normalization
 *
 * Checks both the original form and normalized form (without hyphens),
 * returning the minimum distance.
 *
 * @param input - User input
 * @param candidate - Candidate to compare against
 * @returns The minimum edit distance
 */
function normalizedDistance(input: string, candidate: string): number {
  // Compare both original and normalized forms
  return Math.min(
    levenshtein(input.toLowerCase(), candidate.toLowerCase()),
    levenshtein(normalizeFlag(input), normalizeFlag(candidate))
  );
}

/**
 * Find the best match for a string from a list of candidates
 *
 * Returns the candidate with the smallest edit distance, if it's
 * within the maximum allowed distance.
 *
 * @param input - The input string to match
 * @param candidates - List of valid candidates
 * @param maxDistance - Maximum allowed edit distance (default: 3)
 * @returns The best matching candidate, or undefined if none found within maxDistance
 */
export function findClosestMatch(
  input: string,
  candidates: string[],
  maxDistance: number = 3
): string | undefined {
  let bestMatch: string | undefined;
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    const distance = normalizedDistance(input, candidate);

    if (distance < bestDistance && distance <= maxDistance) {
      bestDistance = distance;
      bestMatch = candidate;
    } else if (distance === bestDistance && distance <= maxDistance && bestMatch) {
      // When distances are equal, prefer shorter flag names
      if (candidate.length < bestMatch.length) {
        bestMatch = candidate;
      }
    }
  }

  return bestMatch;
}
