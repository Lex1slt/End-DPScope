import { describe, it, expect } from 'vitest';
import { extractRawEntries, resolveHitsFromSheet } from './resolveHits';

// A `skillId`-scoped modifier resolves against a hit's skillId, which is layered:
// hit `id` > hitgroup `id` > segment `skillId` > action skillId. The hit > hitgroup part is
// computed in extractRawEntries and carried through resolveHitsFromSheet.
function resolvedHitSkillId(hitId?: string, groupId?: string): string | undefined {
  const skill = {
    segments: [
      {
        damageGroups: [
          {
            ...(groupId ? { id: groupId } : {}),
            element: 'nature',
            multiplier: [100],
            hits: [{ ...(hitId ? { id: hitId } : {}), offset: 0 }],
          },
        ],
      },
    ],
  } as any;
  const hits = resolveHitsFromSheet([], extractRawEntries(skill, 0), 0);
  return (hits[0] as any).skillId;
}

describe('hit skillId: hit id > hitgroup id', () => {
  it('uses the hit id when present', () => {
    expect(resolvedHitSkillId('the-hit', 'the-group')).toBe('the-hit');
  });
  it('falls back to the hitgroup id when the hit has no id', () => {
    expect(resolvedHitSkillId(undefined, 'the-group')).toBe('the-group');
  });
  it('leaves skillId unset when neither has an id (compile fills segment/action)', () => {
    expect(resolvedHitSkillId(undefined, undefined)).toBeUndefined();
  });
});
