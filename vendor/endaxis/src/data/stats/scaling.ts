import type { Attributes } from './types';

/**
 * Sum attribute values for the given basis names.
 * Used by both sheet-effect resolution (Phase 2) and simulation effect dispatch.
 */
export function computeScalingBasis(basis: string | string[], attrs: Attributes): number {
  const parts = Array.isArray(basis) ? basis : [basis];
  let total = 0;
  for (const part of parts) {
    const b = part.trim().toLowerCase();
    if (b === 'strength') total += attrs.strength;
    else if (b === 'agility') total += attrs.agility;
    else if (b === 'intellect') total += attrs.intellect;
    else if (b === 'will') total += attrs.will;
  }
  return total;
}
