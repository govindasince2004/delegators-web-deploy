import { describe, expect, it } from 'vitest';
import { FLOW_PLANS, PUBLIC_PLANS, WORKBENCH_STUDIO_PLAN_CODES, isUnifiedPass, passCardFeatureBullets, workbenchStudioEligible } from './plans';

// This pricing was decided deliberately. These tests pin the public catalog so
// any accidental change to a code, price, or the public set fails CI loudly
// instead of silently charging the wrong amount. The expected values mirror the
// canonical backend (internal/sessions/plans.go) and its plans_test.go.
//
// The headline product is two launch `dlg_*` passes (150-min window, usable on
// both SWE clients and the Workbench). Pro is self-serve; UltraSpeed is beta.

const EXPECTED = {
    dlg_lite: { name: 'Pro', price: '₹49', priceInr: 49, thinking: true },
    dlg_ultra: { name: 'UltraSpeed Beta', price: '₹199', priceInr: 199, thinking: true },
} as const;

describe('public pass catalog (pricing contract)', () => {
    it('exposes exactly the two launch passes, in order', () => {
        expect(PUBLIC_PLANS.map((p) => p.code)).toEqual([
            'dlg_lite',
            'dlg_ultra',
        ]);
    });

    it('each pass matches the canonical backend (name, price, thinking)', () => {
        for (const plan of PUBLIC_PLANS) {
            const expected = EXPECTED[plan.code as keyof typeof EXPECTED];
            expect(expected, `unexpected plan code ${plan.code}`).toBeDefined();
            expect(plan.name).toBe(expected.name);
            expect(plan.price).toBe(expected.price);
            expect(plan.priceInr).toBe(expected.priceInr);
            expect(plan.thinking).toBe(expected.thinking);
        }
    });

    it('displayed rupee price equals the numeric priceInr', () => {
        for (const plan of PUBLIC_PLANS) {
            expect(plan.price).toBe(`₹${plan.priceInr}`);
        }
    });

    it('both launch passes include a thinking alias', () => {
        expect(PUBLIC_PLANS.map((p) => p.thinking)).toEqual([true, true]);
    });

    it('keeps the public Pro pass model surface to two aliases', () => {
        const pro = PUBLIC_PLANS.find((p) => p.code === 'dlg_lite')!;
        expect(pro.models).toEqual(['dlg-pro', 'dlg-light']);
    });

    it('every pass is a unified dlg_* pass', () => {
        for (const plan of PUBLIC_PLANS) {
            expect(isUnifiedPass(plan.code)).toBe(true);
        }
    });

    it('sells image analysis as an included feature, not a separate public model', () => {
        const pro = PUBLIC_PLANS.find((p) => p.code === 'dlg_lite')!;
        expect(pro.models).not.toContain('art-vision');
        expect(passCardFeatureBullets(pro).join(' ')).toContain('image analysis');
    });

    it('exact prices are 49 / 199', () => {
        expect(PUBLIC_PLANS.map((p) => p.priceInr)).toEqual([49, 199]);
    });

    it('studio tier codes match backend WorkbenchEligible (Pro + Ultra only)', () => {
        expect([...WORKBENCH_STUDIO_PLAN_CODES]).toEqual(['dlg_lite', 'dlg_ultra']);
        expect(workbenchStudioEligible('dlg_lite')).toBe(true);
        expect(workbenchStudioEligible('dlg_pro')).toBe(false);
        expect(workbenchStudioEligible('dlg_ultra')).toBe(true);
    });

    it('pass card bullets sell Workbench studio files on Pro', () => {
        const lite = PUBLIC_PLANS.find((p) => p.code === 'dlg_lite')!;
        expect(passCardFeatureBullets(lite).some((b) => b.includes('@ppt'))).toBe(true);
    });
});

describe('Flow pass catalog', () => {
    it('exposes free and invite-only Pro+ beta tiers', () => {
        expect(FLOW_PLANS.map((p) => p.code)).toEqual(['dlg_flow', 'dlg_flow_pro']);
        expect(FLOW_PLANS[0].inviteOnly).not.toBe(true);
        expect(FLOW_PLANS[1].inviteOnly).toBe(true);
    });
});
