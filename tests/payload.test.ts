import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildMortgagePayload,
  saveMortgagePayload,
  loadMortgagePayload,
  saveMortgageDraft,
  loadMortgageDraft,
  clearMortgageDraft,
  STORAGE_KEY,
  DRAFT_STORAGE_KEY,
  type ScenarioSelection,
} from '../src/lib/storage';
import { buildLifePlanUrl } from '../src/lib/lifePlanUrl';
import type { MortgageInput } from '../src/types/mortgage';

function makeInput(overrides: Partial<MortgageInput> = {}): MortgageInput {
  return {
    currentAge: 40,
    balance: 32_000_000,
    rate: 0.925,
    rateType: 'variable',
    monthlyPayment: 95_000,
    calculatedMonthlyPayment: 95_000,
    monthlyPaymentSource: 'manual',
    bonusAnnual: 0,
    remainingYears: 30,
    repayMethod: 'equal-principal',
    fixedPeriodRemainingYears: null,
    postFixedRate: null,
    ...overrides,
  };
}

const current: ScenarioSelection = { source: 'currentPlan', selectedMonthlyYen: 95_000 };

describe('buildMortgagePayload', () => {
  it('現在の返済条件: 円単位・年間返済額・列挙変換が正しい', () => {
    const p = buildMortgagePayload(makeInput(), current, '2026-06-16T00:00:00.000Z');
    expect(p.selectedSource).toBe('currentPlan');
    expect(p.selectedMonthlyPaymentYen).toBe(95_000); // 円
    expect(p.selectedAnnualPaymentYen).toBe(95_000 * 12); // ボーナス0
    expect(p.balanceYen).toBe(32_000_000); // 円（万円ではない）
    expect(p.interestRate).toBe(0.925); // %表記
    expect(p.remainingYears).toBe(30);
    expect(p.repaymentMethod).toBe('equalPrincipal');
    expect(p.rateType).toBe('variable');
    expect(p.version).toBe(1);
    expect(p.savedAt).toBe('2026-06-16T00:00:00.000Z');
  });

  it('年間返済額にボーナス返済年額が加算される', () => {
    const p = buildMortgagePayload(
      makeInput({ bonusAnnual: 200_000 }),
      { source: 'currentPlan', selectedMonthlyYen: 95_000 },
      'now',
    );
    expect(p.selectedAnnualPaymentYen).toBe(95_000 * 12 + 200_000);
    expect(p.bonusAnnualYen).toBe(200_000);
  });

  it('金利変更シナリオ source=rateAdjusted が保存される', () => {
    const sel: ScenarioSelection = {
      source: 'rateAdjusted',
      selectedMonthlyYen: 108_000,
      scenarioMonthlyYen: 108_000,
      scenarioRate: 1.425,
      scenarioLabel: '金利変更シナリオ',
    };
    const p = buildMortgagePayload(makeInput(), sel, 'now');
    expect(p.selectedSource).toBe('rateAdjusted');
    expect(p.selectedMonthlyPaymentYen).toBe(108_000);
    expect(p.scenarioMonthlyPaymentYen).toBe(108_000);
    expect(p.scenarioInterestRate).toBe(1.425);
    expect(p.scenarioLabel).toBe('金利変更シナリオ');
  });

  it('固定期間終了後シナリオ source=fixedPeriodScenario と固定期間項目が保存される', () => {
    const input = makeInput({
      rateType: 'fixed-period',
      fixedPeriodRemainingYears: 7,
      postFixedRate: 1.5,
    });
    const sel: ScenarioSelection = {
      source: 'fixedPeriodScenario',
      selectedMonthlyYen: 102_000,
      scenarioMonthlyYen: 102_000,
      scenarioRate: 1.5,
      scenarioLabel: '固定期間終了後シナリオ',
    };
    const p = buildMortgagePayload(input, sel, 'now');
    expect(p.selectedSource).toBe('fixedPeriodScenario');
    expect(p.rateType).toBe('fixedPeriod');
    expect(p.fixedPeriodRemainingYears).toBe(7);
    expect(p.afterFixedRate).toBe(1.5);
  });

  it('変動金利では固定期間 2 項目を含めない', () => {
    const p = buildMortgagePayload(makeInput(), current, 'now');
    expect('fixedPeriodRemainingYears' in p).toBe(false);
    expect('afterFixedRate' in p).toBe(false);
  });
});

describe('localStorage の確定キーと下書きキーの分離', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    const ls = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() {
        return Object.keys(store).length;
      },
    } as Storage;
    (globalThis as unknown as { localStorage: Storage }).localStorage = ls;
    (globalThis as unknown as { window: { localStorage: Storage } }).window = { localStorage: ls };
  });

  it('反映で lifePlanLab:mortgage に確定保存され、読み戻せる', () => {
    const p = buildMortgagePayload(makeInput(), current, 'now');
    expect(saveMortgagePayload(p)).toBe(true);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(loadMortgagePayload()?.selectedMonthlyPaymentYen).toBe(95_000);
  });

  it('下書きの保存→復元→削除ができる', () => {
    expect(loadMortgageDraft()).toBeNull();
    saveMortgageDraft(makeInput({ balance: 12_345_678 }));
    expect(loadMortgageDraft()?.balance).toBe(12_345_678);
    clearMortgageDraft();
    expect(loadMortgageDraft()).toBeNull();
  });

  it('確定キーと下書きキーは混同されない', () => {
    saveMortgageDraft(makeInput({ monthlyPayment: 70_000 }));
    const p = buildMortgagePayload(makeInput({ monthlyPayment: 95_000 }), current, 'now');
    saveMortgagePayload(p);

    expect(STORAGE_KEY).not.toBe(DRAFT_STORAGE_KEY);
    // 下書きは入力スナップショット、確定はペイロード形式で別物
    expect(loadMortgageDraft()?.monthlyPayment).toBe(70_000);
    expect(loadMortgagePayload()?.selectedMonthlyPaymentYen).toBe(95_000);
    // 確定保存で下書きキーは書き換わらない
    const draftRaw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    expect(JSON.parse(draftRaw as string).input.monthlyPayment).toBe(70_000);
  });
});

describe('buildLifePlanUrl', () => {
  const base = 'https://life-plan-lab.example.com/';

  it('mortgage* パラメータが円・%・年で付く', () => {
    const p = buildMortgagePayload(
      makeInput({ balance: 32_000_000, rate: 0.925, remainingYears: 30, monthlyPayment: 95_000 }),
      current,
      'now',
    );
    const url = new URL(buildLifePlanUrl(base, p));
    expect(url.searchParams.get('mortgageMonthlyPaymentYen')).toBe('95000');
    expect(url.searchParams.get('mortgageAnnualPaymentYen')).toBe(String(95_000 * 12));
    expect(url.searchParams.get('mortgageBalanceYen')).toBe('32000000');
    expect(url.searchParams.get('mortgageInterestRate')).toBe('0.925');
    expect(url.searchParams.get('mortgageRemainingYears')).toBe('30');
    expect(url.searchParams.get('mortgageSource')).toBe('currentPlan');
    // 汎用名は使わない
    expect(url.searchParams.has('monthly')).toBe(false);
    expect(url.searchParams.has('balance')).toBe(false);
  });

  it('不正値（残高0・年数0・金利過大）はパラメータに出さない', () => {
    const p = buildMortgagePayload(
      makeInput({ balance: 0, remainingYears: 0, rate: 99 }),
      { source: 'currentPlan', selectedMonthlyYen: 0 },
      'now',
    );
    const url = new URL(buildLifePlanUrl(base, p));
    expect(url.searchParams.has('mortgageBalanceYen')).toBe(false);
    expect(url.searchParams.has('mortgageRemainingYears')).toBe(false);
    expect(url.searchParams.has('mortgageInterestRate')).toBe(false);
    expect(url.searchParams.has('mortgageMonthlyPaymentYen')).toBe(false);
    // source は常に付与
    expect(url.searchParams.get('mortgageSource')).toBe('currentPlan');
  });

  it('任意項目: ボーナス・返済方式・金利タイプが付く', () => {
    const p = buildMortgagePayload(
      makeInput({ bonusAnnual: 200_000, repayMethod: 'equal-principal', rateType: 'variable' }),
      current,
      'now',
    );
    const url = new URL(buildLifePlanUrl(base, p));
    expect(url.searchParams.get('mortgageBonusAnnualYen')).toBe('200000');
    expect(url.searchParams.get('mortgageRepaymentMethod')).toBe('equalPrincipal');
    expect(url.searchParams.get('mortgageRateType')).toBe('variable');
  });
});
