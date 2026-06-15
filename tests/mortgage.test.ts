import { describe, it, expect, beforeEach } from 'vitest';
import {
  safeNumber,
  annualPayment,
  payoffAge,
  remainingTotal,
  equalInstallmentMonthly,
  computeResult,
  rateScenario,
  rateScenarioAt,
} from '../src/lib/mortgage';
import { buildSavedMortgage, saveMortgage, STORAGE_KEY } from '../src/lib/storage';
import type { MortgageInput } from '../src/types/mortgage';

const baseInput: MortgageInput = {
  currentAge: 40,
  balance: 30_000_000,
  rate: 0.925,
  rateType: 'variable',
  monthlyPayment: 85_000,
  bonusAnnual: 200_000,
  remainingYears: 25,
  repayMethod: 'equal-payment',
};

describe('safeNumber', () => {
  it('null / undefined / NaN / Infinity / 負値を 0 に正規化する', () => {
    expect(safeNumber(null)).toBe(0);
    expect(safeNumber(undefined)).toBe(0);
    expect(safeNumber(NaN)).toBe(0);
    expect(safeNumber(Infinity)).toBe(0);
    expect(safeNumber(-100)).toBe(0);
    expect(safeNumber(1234)).toBe(1234);
  });
});

describe('annualPayment', () => {
  it('年間返済額 = 毎月 × 12 + ボーナス', () => {
    expect(annualPayment(85_000, 200_000)).toBe(85_000 * 12 + 200_000);
  });

  it('ボーナス返済 年額が反映される', () => {
    const withoutBonus = annualPayment(85_000, 0);
    const withBonus = annualPayment(85_000, 200_000);
    expect(withBonus - withoutBonus).toBe(200_000);
  });

  it('未入力（null）でもクラッシュせず 0 ベースで計算する', () => {
    expect(annualPayment(null, null)).toBe(0);
    expect(annualPayment(85_000, null)).toBe(85_000 * 12);
  });
});

describe('payoffAge', () => {
  it('完済予定年齢 = 現在年齢 + 残り返済年数', () => {
    expect(payoffAge(40, 25)).toBe(65);
  });

  it('未入力でも 0 ベースで返す', () => {
    expect(payoffAge(null, null)).toBe(0);
    expect(payoffAge(40, null)).toBe(40);
  });
});

describe('remainingTotal', () => {
  it('残り返済総額の概算 = 年間返済額 × 残り返済年数', () => {
    const annual = annualPayment(85_000, 200_000); // 1,220,000
    expect(remainingTotal(annual, 25)).toBe(annual * 25);
  });

  it('残り年数 0 なら 0', () => {
    expect(remainingTotal(1_220_000, 0)).toBe(0);
  });
});

describe('equalInstallmentMonthly', () => {
  it('金利 0% は 残高 / 回数 になる', () => {
    // 30,000,000 / (25*12=300) = 100,000
    expect(equalInstallmentMonthly(30_000_000, 0, 25)).toBe(100_000);
  });

  it('代表値の概算月返済額（元利均等）が妥当な範囲', () => {
    // 残高3000万 / 金利0.925% / 25年 → おおよそ 11.2万円前後
    const m = equalInstallmentMonthly(30_000_000, 0.925, 25);
    expect(m).toBeGreaterThan(110_000);
    expect(m).toBeLessThan(115_000);
  });

  it('金利が高いほど月返済額は増える（単調性）', () => {
    const low = equalInstallmentMonthly(30_000_000, 0.5, 25);
    const high = equalInstallmentMonthly(30_000_000, 1.5, 25);
    expect(high).toBeGreaterThan(low);
  });

  it('既知の閉形式と一致する（誤差 1 円未満）', () => {
    // r = 1%/12, n = 120, balance = 10,000,000
    const balance = 10_000_000;
    const annualPct = 1;
    const years = 10;
    const r = annualPct / 100 / 12;
    const n = years * 12;
    const expected = (balance * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    expect(equalInstallmentMonthly(balance, annualPct, years)).toBeCloseTo(expected, 2);
  });

  it('0 / 未入力でクラッシュせず 0 を返し、NaN/Infinity を返さない', () => {
    expect(equalInstallmentMonthly(0, 1, 25)).toBe(0);
    expect(equalInstallmentMonthly(30_000_000, 1, 0)).toBe(0);
    expect(equalInstallmentMonthly(null, null, null)).toBe(0);
    const v = equalInstallmentMonthly(-100, -1, -5);
    expect(Number.isFinite(v)).toBe(true);
  });
});

describe('computeResult', () => {
  it('入力一式から主指標をまとめて計算する', () => {
    const r = computeResult(baseInput);
    expect(r.annualPayment).toBe(85_000 * 12 + 200_000);
    expect(r.payoffAge).toBe(65);
    expect(r.remainingTotal).toBe(r.annualPayment * 25);
    expect(r.referenceMonthly).toBeGreaterThan(0);
  });

  it('すべて null/未入力でも有限な結果を返す', () => {
    const empty: MortgageInput = {
      currentAge: null,
      balance: null,
      rate: null,
      rateType: 'variable',
      monthlyPayment: null,
      bonusAnnual: null,
      remainingYears: null,
      repayMethod: 'equal-payment',
    };
    const r = computeResult(empty);
    expect(r.annualPayment).toBe(0);
    expect(r.payoffAge).toBe(0);
    expect(r.remainingTotal).toBe(0);
    expect(r.referenceMonthly).toBe(0);
    expect(Number.isFinite(r.referenceMonthly)).toBe(true);
  });
});

describe('rateScenario', () => {
  it('金利を上げると毎月・年間・残り総額の増加分が正になる', () => {
    const s = rateScenario(30_000_000, 0.925, 25, 1.0);
    expect(s.newRate).toBeCloseTo(1.925, 6);
    expect(s.monthlyIncrease).toBeGreaterThan(0);
    expect(s.annualIncrease).toBeCloseTo(s.monthlyIncrease * 12, 6);
    expect(s.remainingTotalIncrease).toBeCloseTo(s.annualIncrease * 25, 6);
  });

  it('delta 0 なら増加分はすべて 0', () => {
    const s = rateScenario(30_000_000, 0.925, 25, 0);
    expect(s.monthlyIncrease).toBeCloseTo(0, 6);
    expect(s.annualIncrease).toBeCloseTo(0, 6);
    expect(s.remainingTotalIncrease).toBeCloseTo(0, 6);
  });

  it('金利は 0 未満にクランプされる', () => {
    const s = rateScenario(30_000_000, 0.5, 25, -2.0);
    expect(s.newRate).toBe(0);
  });

  it('0 / 未入力でも有限値を返す', () => {
    const s = rateScenario(null, null, null, 1.0);
    expect(Number.isFinite(s.monthlyIncrease)).toBe(true);
    expect(s.referenceMonthly).toBe(0);
  });
});

describe('rateScenarioAt', () => {
  it('絶対金利を指定した場合、delta は target - base になる', () => {
    const at = rateScenarioAt(30_000_000, 0.925, 25, 1.925);
    const by = rateScenario(30_000_000, 0.925, 25, 1.0);
    expect(at.referenceMonthly).toBeCloseTo(by.referenceMonthly, 6);
    expect(at.monthlyIncrease).toBeCloseTo(by.monthlyIncrease, 6);
  });
});

describe('buildSavedMortgage', () => {
  it('localStorage 保存用データが期待する形になる', () => {
    const saved = buildSavedMortgage(baseInput, '2026-06-15T00:00:00.000Z');
    expect(saved).toEqual({
      version: 1,
      source: 'mortgage-simulator',
      savedAt: '2026-06-15T00:00:00.000Z',
      mortgage: {
        balance: 30_000_000,
        monthlyPayment: 85_000,
        bonusAnnual: 200_000,
        remainingYears: 25,
        rate: 0.925,
        rateType: 'variable',
        repayMethod: 'equal-payment',
      },
    });
  });

  it('未入力（null）は 0 に正規化される', () => {
    const saved = buildSavedMortgage(
      { ...baseInput, balance: null, monthlyPayment: null, rate: null },
      '2026-06-15T00:00:00.000Z',
    );
    expect(saved.mortgage.balance).toBe(0);
    expect(saved.mortgage.monthlyPayment).toBe(0);
    expect(saved.mortgage.rate).toBe(0);
  });
});

describe('saveMortgage (localStorage)', () => {
  beforeEach(() => {
    // jsdom が無くても動くよう、最小のスタブを用意する
    const store: Record<string, string> = {};
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
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
    (globalThis as unknown as { window: { localStorage: Storage } }).window = {
      localStorage: (globalThis as unknown as { localStorage: Storage }).localStorage,
    };
  });

  it('保存に成功し、キーと中身が読み戻せる', () => {
    expect(saveMortgage(baseInput)).toBe(true);
    const raw = (globalThis as unknown as { localStorage: Storage }).localStorage.getItem(
      STORAGE_KEY,
    );
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.source).toBe('mortgage-simulator');
    expect(parsed.version).toBe(1);
    expect(parsed.mortgage.balance).toBe(30_000_000);
    expect(typeof parsed.savedAt).toBe('string');
  });
});
