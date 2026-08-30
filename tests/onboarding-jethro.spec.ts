import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8787';
const DEMO_USER = 'tech@gehc.demo';

async function loginAsDemo(request: import('@playwright/test').APIRequestContext) {
  const res = await request.post(`${BASE_URL}/api/demo/impersonate`, {
    data: { email: DEMO_USER },
  });
  expect(res.ok()).toBeTruthy();
}

test.describe('Onboarding + Jethro Placement API flow', () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ request }) => {
    await loginAsDemo(request);
  });

  test('pending newcomers → batch → bulk approve → commit', async ({ request }) => {
    const pendingRes = await request.get(`${BASE_URL}/api/pending-approval`);
    expect(pendingRes.ok()).toBeTruthy();
    const { pending } = await pendingRes.json();
    expect(Array.isArray(pending)).toBeTruthy();
    expect(pending.length).toBeGreaterThan(0);

    const eligible = pending.filter(
      (e: { userId?: string; giftTestDone?: boolean; gender?: string }) =>
        e.userId && e.giftTestDone && e.gender,
    );
    expect(eligible.length).toBeGreaterThan(0);

    const poolId = eligible[0].id;
    const advRes = await request.get(
      `${BASE_URL}/api/jethro/placement/advanced?ids=${poolId}`,
    );
    expect(advRes.ok()).toBeTruthy();
    const { recommendations } = await advRes.json();
    expect(Array.isArray(recommendations)).toBeTruthy();
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0].newcomerGender).toBeTruthy();
    expect(Array.isArray(recommendations[0].newcomerGiftsTop5)).toBeTruthy();

    const batchRes = await request.post(`${BASE_URL}/api/jethro/placement/batch`, {
      data: {
        recommendations: recommendations.map((r: Record<string, unknown>) => ({
          newcomerId: r.newcomerId,
          newcomerName: r.newcomerName,
          newcomerGender: r.newcomerGender,
          newcomerGiftsTop5: r.newcomerGiftsTop5,
          newcomerMaturityScore: r.newcomerMaturityScore,
          recommendedGroupId: r.recommendedGroupId,
          recommendedGroupName: r.recommendedGroupName,
          recommendedRole: r.recommendedRole,
          confidence: r.confidence,
          reasons: r.reasons,
          scoreBreakdown: r.scoreBreakdown,
        })),
      },
    });
    expect(batchRes.ok()).toBeTruthy();
    const batch = await batchRes.json();
    expect(batch.id).toBeTruthy();
    expect(batch.items?.length).toBeGreaterThan(0);

    const approveRes = await request.patch(
      `${BASE_URL}/api/jethro/placement/batch/${batch.id}/bulk-approve`,
    );
    expect(approveRes.ok()).toBeTruthy();
    const approveData = await approveRes.json();
    expect(approveData.updated).toBeGreaterThan(0);

    const batchDetailRes = await request.get(
      `${BASE_URL}/api/jethro/placement/batch/${batch.id}`,
    );
    expect(batchDetailRes.ok()).toBeTruthy();
    const batchDetail = await batchDetailRes.json();
    for (const item of batchDetail.items) {
      expect(['APPROVED', 'REVISED']).toContain(item.status);
      if (!item.finalIsIndividu) {
        expect(item.finalGroupId).toBeTruthy();
        expect(item.finalRole).toBeTruthy();
      }
    }

    const commitRes = await request.post(
      `${BASE_URL}/api/jethro/placement/batch/${batch.id}/commit`,
    );
    expect(commitRes.ok()).toBeTruthy();
    const commitData = await commitRes.json();
    expect(commitData.created + commitData.individu).toBeGreaterThan(0);
    expect(commitData.errors?.length || 0).toBe(0);

    const newcomerId = recommendations[0].newcomerId;
    const wpRes = await request.get(`${BASE_URL}/api/waiting-pool?status=ROLE_ASSIGNED`);
    expect(wpRes.ok()).toBeTruthy();
    const { pool } = await wpRes.json();
    const assigned = pool.find((e: { userId?: string }) => e.userId === newcomerId);
    expect(assigned).toBeTruthy();
    expect(assigned.status).toBe('ROLE_ASSIGNED');
  });

  test('waiting-pool lists ROLE_ASSIGNED separately from pending', async ({ request }) => {
    const [waitingRes, pendingRes, assignedRes] = await Promise.all([
      request.get(`${BASE_URL}/api/waiting-pool`),
      request.get(`${BASE_URL}/api/pending-approval`),
      request.get(`${BASE_URL}/api/waiting-pool?status=ROLE_ASSIGNED`),
    ]);
    expect(waitingRes.ok()).toBeTruthy();
    expect(pendingRes.ok()).toBeTruthy();
    expect(assignedRes.ok()).toBeTruthy();

    const waiting = (await waitingRes.json()).pool || [];
    const pending = (await pendingRes.json()).pending || [];
    const assigned = (await assignedRes.json()).pool || [];

    for (const e of waiting) expect(e.status).toBe('WAITING_POOL');
    for (const e of pending) expect(e.status).toBe('PROFILE_COMPLETED');
    for (const e of assigned) expect(e.status).toBe('ROLE_ASSIGNED');
  });
});
