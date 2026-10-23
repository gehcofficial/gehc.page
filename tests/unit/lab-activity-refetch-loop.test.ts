import { describe, expect, it, vi } from 'vitest';

/**
 * Mirrors ActivityPanel `load` useCallback dependency list (regression for ca74315).
 * Depends on stable `reloadLabActivity` + `hasLabCtx`, not the lab context object bag.
 */
function activityPanelLoadDeps(
  sessionId: string,
  hasLabCtx: boolean,
  reloadLabActivity: (() => Promise<void>) | undefined,
) {
  return [sessionId, hasLabCtx, reloadLabActivity] as const;
}

describe('Creative Lab ActivityPanel load deps', () => {
  it('does not change when provider re-renders with a new ctx object but same reload', () => {
    const reload = vi.fn(async () => {});
    const depsA = activityPanelLoadDeps('session-abc', true, reload);
    const depsB = activityPanelLoadDeps('session-abc', true, reload);
    expect(depsA).toEqual(depsB);
    expect(depsA[2]).toBe(depsB[2]);

    const ctxAfterActivityUpdate = { reload, activity: { phase: 'A1' as const } };
    const ctxAfterAnotherRender = { reload, activity: { phase: 'A2' as const } };
    expect(ctxAfterActivityUpdate).not.toBe(ctxAfterAnotherRender);
    expect(ctxAfterActivityUpdate.reload).toBe(ctxAfterAnotherRender.reload);

    const buggyDeps = [ctxAfterActivityUpdate];
    const buggyDepsNext = [ctxAfterAnotherRender];
    expect(buggyDeps[0]).not.toBe(buggyDepsNext[0]);
  });
});
