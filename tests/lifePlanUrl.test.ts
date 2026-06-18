import { describe, it, expect } from 'vitest';
import { buildLifePlanUrl, isUsableLifePlanUrl } from '../src/lib/lifePlanUrl';
import { LIFE_PLAN_LAB_URL } from '../src/strings/ja';
import { buildMortgagePayload, type ScenarioSelection } from '../src/lib/storage';
import type { MortgageInput } from '../src/types/mortgage';

function makeInput(overrides: Partial<MortgageInput> = {}): MortgageInput {
  return {
    currentAge: 40,
    balance: 32_000_000,
    rate: 1.2,
    rateType: 'variable',
    monthlyPayment: 116_177,
    calculatedMonthlyPayment: 116_177,
    monthlyPaymentSource: 'manual',
    bonusAnnual: 0,
    remainingYears: 30,
    repayMethod: 'equal-principal',
    fixedPeriodRemainingYears: null,
    postFixedRate: null,
    ...overrides,
  };
}

describe('isUsableLifePlanUrl', () => {
  it('example.com 系・空・不正は使えない', () => {
    expect(isUsableLifePlanUrl('https://life-plan-lab.example.com/')).toBe(false);
    expect(isUsableLifePlanUrl('https://example.com/')).toBe(false);
    expect(isUsableLifePlanUrl('')).toBe(false);
    expect(isUsableLifePlanUrl('   ')).toBe(false);
    expect(isUsableLifePlanUrl('not a url')).toBe(false);
  });

  it('本番URLは使える', () => {
    expect(isUsableLifePlanUrl('https://fire-lifeplan-lab.com/life-plan-simulator/')).toBe(true);
  });
});

describe('LIFE_PLAN_LAB_URL（本番デフォルト）', () => {
  it('example.com ではなく本番URLである', () => {
    expect(LIFE_PLAN_LAB_URL).not.toContain('example.com');
    expect(isUsableLifePlanUrl(LIFE_PLAN_LAB_URL)).toBe(true);
    expect(LIFE_PLAN_LAB_URL).toBe('https://fire-lifeplan-lab.com/life-plan-simulator/');
  });
});

describe('buildLifePlanUrl', () => {
  const base = 'https://fire-lifeplan-lab.com/life-plan-simulator/';

  it('host は example.com でなく、パスを保ったまま mortgage* を付与', () => {
    const p = buildMortgagePayload(
      makeInput(),
      { source: 'currentPlan', selectedMonthlyYen: 116_177 },
      'now',
    );
    const url = new URL(buildLifePlanUrl(base, p));
    expect(url.hostname).toBe('fire-lifeplan-lab.com');
    expect(url.hostname).not.toContain('example.com');
    expect(url.pathname).toBe('/life-plan-simulator/');
    expect(url.searchParams.get('mortgageMonthlyPaymentYen')).toBe('116177');
    expect(url.searchParams.get('mortgageSource')).toBe('currentPlan');
  });

  it('選択 source ごとに mortgageSource と返済額が一致する', () => {
    const input = makeInput({
      rateType: 'fixed-period',
      fixedPeriodRemainingYears: 10,
      postFixedRate: 1.8,
    });
    const cases: { sel: ScenarioSelection; source: string; monthly: number }[] = [
      { sel: { source: 'currentPlan', selectedMonthlyYen: 116_177 }, source: 'currentPlan', monthly: 116_177 },
      {
        sel: { source: 'rateAdjusted', selectedMonthlyYen: 130_000, scenarioRate: 1.7 },
        source: 'rateAdjusted',
        monthly: 130_000,
      },
      {
        sel: { source: 'fixedPeriodScenario', selectedMonthlyYen: 142_000, scenarioRate: 1.8 },
        source: 'fixedPeriodScenario',
        monthly: 142_000,
      },
    ];
    for (const c of cases) {
      const url = new URL(buildLifePlanUrl(base, buildMortgagePayload(input, c.sel, 'now')));
      expect(url.searchParams.get('mortgageSource')).toBe(c.source);
      expect(url.searchParams.get('mortgageMonthlyPaymentYen')).toBe(String(c.monthly));
    }
  });

  it('未設定（不正 URL）でも example.com を返さない', () => {
    // isUsableLifePlanUrl が false の URL はボタン無効化に使う想定。組み立てても example.com を生成しない。
    expect(isUsableLifePlanUrl('')).toBe(false);
    const out = buildLifePlanUrl(
      'https://fire-lifeplan-lab.com/life-plan-simulator/',
      buildMortgagePayload(makeInput(), { source: 'currentPlan', selectedMonthlyYen: 1 }, 'now'),
    );
    expect(out).not.toContain('example.com');
  });
});
