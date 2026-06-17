import { describe, it, expect, beforeEach } from 'vitest';
import {
  safeNumber,
  annualPayment,
  payoffAge,
  remainingTotal,
  equalInstallmentMonthly,
  equalPrincipalFirstMonthly,
  equalPrincipalAverageMonthly,
  referenceMonthlyByMethod,
  computeResult,
  rateScenario,
  rateScenarioAt,
  buildAmortizationSchedule,
  fixedPeriodImpact,
  fixedPeriodExceedsTerm,
  isSignificantMonthlyDivergence,
  monthlyPaymentDivergence,
} from '../src/lib/mortgage';
import { useMortgageStore, initialInput } from '../src/store/useMortgageStore';
import type { MortgageInput } from '../src/types/mortgage';

/** テスト用に完全な MortgageInput を作る（新フィールドの既定値を含む）。 */
function makeInput(overrides: Partial<MortgageInput> = {}): MortgageInput {
  return {
    currentAge: 40,
    balance: 30_000_000,
    rate: 0.925,
    rateType: 'variable',
    monthlyPayment: 85_000,
    calculatedMonthlyPayment: 96_261,
    monthlyPaymentSource: 'auto',
    bonusAnnual: 200_000,
    remainingYears: 25,
    repayMethod: 'equal-payment',
    fixedPeriodRemainingYears: null,
    postFixedRate: null,
    ...overrides,
  };
}

const baseInput: MortgageInput = makeInput();

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
    const empty: MortgageInput = makeInput({
      currentAge: null,
      balance: null,
      rate: null,
      monthlyPayment: null,
      calculatedMonthlyPayment: null,
      bonusAnnual: null,
      remainingYears: null,
    });
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

describe('元金均等の月返済額', () => {
  it('金利 0% は 初回・平均ともに 残高 / 回数', () => {
    expect(equalPrincipalFirstMonthly(30_000_000, 0, 25)).toBeCloseTo(100_000, 6);
    expect(equalPrincipalAverageMonthly(30_000_000, 0, 25)).toBeCloseTo(100_000, 6);
  });

  it('初回 > 平均（返済が後半に向けて下がる）', () => {
    const first = equalPrincipalFirstMonthly(30_000_000, 1.0, 25);
    const avg = equalPrincipalAverageMonthly(30_000_000, 1.0, 25);
    expect(first).toBeGreaterThan(avg);
  });

  it('0 / 未入力でクラッシュせず 0 を返す', () => {
    expect(equalPrincipalFirstMonthly(0, 1, 25)).toBe(0);
    expect(equalPrincipalAverageMonthly(30_000_000, 1, 0)).toBe(0);
    expect(Number.isFinite(equalPrincipalFirstMonthly(null, null, null))).toBe(true);
  });
});

describe('referenceMonthlyByMethod', () => {
  it('返済方式に応じて関数を選ぶ（元金均等は現在＝初回付近）', () => {
    const ep = referenceMonthlyByMethod(30_000_000, 0.925, 25, 'equal-payment');
    const epp = referenceMonthlyByMethod(30_000_000, 0.925, 25, 'equal-principal');
    expect(ep).toBeCloseTo(equalInstallmentMonthly(30_000_000, 0.925, 25), 6);
    expect(epp).toBeCloseTo(equalPrincipalFirstMonthly(30_000_000, 0.925, 25), 6);
  });

  it('事例: 元金均等 残高31,500,000 / 31年 / 1.175% の現在額は約115,521円（平均ではない）', () => {
    const ref = referenceMonthlyByMethod(31_500_000, 1.175, 31, 'equal-principal');
    expect(Math.round(ref)).toBe(115_521);
    // 生涯平均（約100,141円）は別物
    expect(Math.round(equalPrincipalAverageMonthly(31_500_000, 1.175, 31))).toBe(100_141);
  });
});

describe('computeResult（返済方式）', () => {
  it('元金均等では referenceMonthly=初回付近（現在の額）, First>Average', () => {
    const r = computeResult(makeInput({ repayMethod: 'equal-principal' }));
    expect(r.referenceMonthly).toBeCloseTo(r.referenceMonthlyFirst, 6);
    expect(r.referenceMonthlyFirst).toBeGreaterThan(r.referenceMonthlyAverage);
  });

  it('元利均等では First=Average=referenceMonthly', () => {
    const r = computeResult(makeInput({ repayMethod: 'equal-payment' }));
    expect(r.referenceMonthlyFirst).toBeCloseTo(r.referenceMonthly, 6);
    expect(r.referenceMonthlyAverage).toBeCloseTo(r.referenceMonthly, 6);
  });
});

describe('rateScenario（返済方式対応）', () => {
  it('元金均等の参考額は元利均等と異なる', () => {
    const ep = rateScenario(30_000_000, 0.925, 25, 1.0, 'equal-payment');
    const epp = rateScenario(30_000_000, 0.925, 25, 1.0, 'equal-principal');
    expect(epp.referenceMonthly).not.toBeCloseTo(ep.referenceMonthly, 1);
    expect(epp.monthlyIncrease).toBeGreaterThan(0);
  });
});

describe('buildAmortizationSchedule', () => {
  it('現在残高から始まり、毎年単調に減り、負にならない', () => {
    const { points } = buildAmortizationSchedule(makeInput({ bonusAnnual: 0 }));
    expect(points[0].balance).toBeCloseTo(30_000_000, 6);
    for (let i = 1; i < points.length; i++) {
      expect(points[i].balance).toBeLessThanOrEqual(points[i - 1].balance + 1);
      expect(points[i].balance).toBeGreaterThanOrEqual(0);
    }
    // 完済予定年数の末尾はおおむね 0 に到達
    expect(points[points.length - 1].balance).toBeLessThan(30_000_000 * 0.05);
  });

  it('完済後の残高は 0 で止まる（負にならない）', () => {
    const { points } = buildAmortizationSchedule(makeInput());
    expect(points.every((p) => p.balance >= 0)).toBe(true);
    expect(points[points.length - 1].balance).toBe(0);
  });

  it('ボーナス返済を入れると、同じ年の残高がより速く減る', () => {
    const withoutBonus = buildAmortizationSchedule(makeInput({ bonusAnnual: 0 }));
    const withBonus = buildAmortizationSchedule(makeInput({ bonusAnnual: 600_000 }));
    const year5 = 5;
    const a = withoutBonus.points.find((p) => p.year === year5)!.balance;
    const b = withBonus.points.find((p) => p.year === year5)!.balance;
    expect(b).toBeLessThan(a);
  });

  it('金利 0% / 高金利 / 残り年数 0 でクラッシュしない', () => {
    expect(() => buildAmortizationSchedule(makeInput({ rate: 0 }))).not.toThrow();
    expect(() => buildAmortizationSchedule(makeInput({ rate: 15 }))).not.toThrow();
    const zero = buildAmortizationSchedule(makeInput({ remainingYears: 0 }));
    expect(zero.points.length).toBeGreaterThanOrEqual(1);
    expect(zero.points.every((p) => Number.isFinite(p.balance) && p.balance >= 0)).toBe(true);
  });

  it('固定期間選択型では固定期間終了年を記録する', () => {
    const { fixedPeriodEndYear } = buildAmortizationSchedule(
      makeInput({
        rateType: 'fixed-period',
        fixedPeriodRemainingYears: 7,
        postFixedRate: 1.5,
      }),
    );
    expect(fixedPeriodEndYear).toBe(7);
  });

  it('固定期間終了後に金利が上がると、その後の残高の減りが緩む', () => {
    // 終了後金利を大きく上げると、同じ初期条件でも後半の残高は高めに残る
    const lowPost = buildAmortizationSchedule(
      makeInput({ rateType: 'fixed-period', fixedPeriodRemainingYears: 5, postFixedRate: 0.5, bonusAnnual: 0 }),
    );
    const highPost = buildAmortizationSchedule(
      makeInput({ rateType: 'fixed-period', fixedPeriodRemainingYears: 5, postFixedRate: 3.0, bonusAnnual: 0 }),
    );
    const y20Low = lowPost.points.find((p) => p.year === 20)!.balance;
    const y20High = highPost.points.find((p) => p.year === 20)!.balance;
    expect(y20High).toBeGreaterThanOrEqual(y20Low);
  });
});

describe('buildAmortizationSchedule の返済額ベース判定', () => {
  it('自動計算のまま（source=auto）は参考ベース', () => {
    const s = buildAmortizationSchedule(makeInput({ monthlyPaymentSource: 'auto' }));
    expect(s.paymentBasis).toBe('reference');
    expect(s.inputPaymentFellBack).toBe(false);
  });

  it('元利均等 + 手動修正で参考額より多い額は入力額ベース（完済が前倒し）', () => {
    const s = buildAmortizationSchedule(
      makeInput({
        repayMethod: 'equal-payment',
        monthlyPaymentSource: 'manual',
        monthlyPayment: 130_000,
        bonusAnnual: 0,
      }),
    );
    expect(s.paymentBasis).toBe('input');
    expect(s.inputPaymentFellBack).toBe(false);
    expect(s.payoffYear).not.toBeNull();
    expect(s.payoffYear!).toBeLessThan(25);
    // 残高は負にならず完済後 0
    expect(s.points.every((p) => p.balance >= 0)).toBe(true);
    expect(s.points[s.points.length - 1].balance).toBe(0);
  });

  it('元利均等 + 手動修正で参考額より少ない額は参考ベースへフォールバック', () => {
    const s = buildAmortizationSchedule(
      makeInput({
        repayMethod: 'equal-payment',
        monthlyPaymentSource: 'manual',
        monthlyPayment: 70_000, // 参考額（約11万円）より小さく、期間内に完済しない
        bonusAnnual: 0,
      }),
    );
    expect(s.paymentBasis).toBe('reference');
    expect(s.inputPaymentFellBack).toBe(true);
  });

  it('元金均等は手動修正でも常に参考ベース', () => {
    const s = buildAmortizationSchedule(
      makeInput({
        repayMethod: 'equal-principal',
        monthlyPaymentSource: 'manual',
        monthlyPayment: 130_000,
      }),
    );
    expect(s.paymentBasis).toBe('reference');
    expect(s.inputPaymentFellBack).toBe(false);
  });
});

describe('fixedPeriodImpact / fixedPeriodExceedsTerm', () => {
  it('固定期間終了後の想定金利が未入力なら configured:false', () => {
    const impact = fixedPeriodImpact(
      makeInput({ rateType: 'fixed-period', fixedPeriodRemainingYears: 7, postFixedRate: null }),
    );
    expect(impact.configured).toBe(false);
  });

  it('終了後金利が現在より高いと、負担増が正になる', () => {
    const impact = fixedPeriodImpact(
      makeInput({
        rate: 0.5,
        rateType: 'fixed-period',
        fixedPeriodRemainingYears: 7,
        postFixedRate: 2.0,
      }),
    );
    expect(impact.configured).toBe(true);
    expect(impact.endAge).toBe(47); // 40 + 7
    expect(impact.balanceAtEnd).toBeGreaterThan(0);
    expect(impact.monthlyIncrease).toBeGreaterThan(0);
    expect(impact.annualIncrease).toBeCloseTo(impact.monthlyIncrease * 12, 6);
  });

  it('固定期間が返済期間を超えると fixedPeriodExceedsTerm が true', () => {
    expect(
      fixedPeriodExceedsTerm(
        makeInput({ rateType: 'fixed-period', fixedPeriodRemainingYears: 30, remainingYears: 25 }),
      ),
    ).toBe(true);
    expect(
      fixedPeriodExceedsTerm(
        makeInput({ rateType: 'fixed-period', fixedPeriodRemainingYears: 7, remainingYears: 25 }),
      ),
    ).toBe(false);
    // 変動金利では常に false
    expect(fixedPeriodExceedsTerm(makeInput({ rateType: 'variable' }))).toBe(false);
  });
});

describe('isSignificantMonthlyDivergence', () => {
  it('差が 5,000 円以上なら有意（5%閾値を下回っても）', () => {
    // 200,000 の 5% = 10,000。差 6,000 は 5% 未満だが 5,000 以上 → true
    expect(isSignificantMonthlyDivergence(200_000, 206_000)).toBe(true);
    expect(isSignificantMonthlyDivergence(200_000, 203_000)).toBe(false); // 差3,000
  });

  it('差が入力額の 5% 以上なら有意（5,000 円未満でも）', () => {
    // 80,000 の 5% = 4,000。差 4,500 は 5,000 未満だが 5% 以上 → true
    expect(isSignificantMonthlyDivergence(80_000, 84_500)).toBe(true);
    expect(isSignificantMonthlyDivergence(80_000, 83_000)).toBe(false); // 差3,000 < 4,000
  });

  it('入力額または参考額が 0 以下なら対象外（false）', () => {
    expect(isSignificantMonthlyDivergence(0, 100_000)).toBe(false);
    expect(isSignificantMonthlyDivergence(100_000, 0)).toBe(false);
  });

  it('符号によらず絶対差で判定する', () => {
    expect(isSignificantMonthlyDivergence(120_000, 100_000)).toBe(true);
    expect(isSignificantMonthlyDivergence(100_000, 120_000)).toBe(true);
  });
});

describe('monthlyPaymentDivergence', () => {
  it('参考額・入力額・差・significant を返す', () => {
    const ref = referenceMonthlyByMethod(30_000_000, 0.925, 25, 'equal-payment');
    // 参考額より明らかに小さい入力額 → 有意
    const d = monthlyPaymentDivergence(makeInput({ monthlyPayment: Math.round(ref) - 12_000 }));
    expect(d.referenceMonthly).toBeCloseTo(ref, 6);
    expect(d.inputMonthly).toBe(Math.round(ref) - 12_000);
    expect(d.diff).toBeCloseTo(d.inputMonthly - d.referenceMonthly, 6);
    expect(d.significant).toBe(true);
  });

  it('入力額が参考額に近いと significant=false', () => {
    const ref = referenceMonthlyByMethod(30_000_000, 0.925, 25, 'equal-payment');
    const d = monthlyPaymentDivergence(makeInput({ monthlyPayment: Math.round(ref) + 1_000 }));
    expect(d.significant).toBe(false);
  });
});

describe('useMortgageStore（毎月返済額の自動計算 / 手動修正）', () => {
  beforeEach(() => {
    useMortgageStore.setState({ phase: 'input', input: { ...initialInput } });
  });

  it('前提を入力すると参考月返済額が自動計算され、毎月返済額に追従する', () => {
    const s = useMortgageStore.getState();
    s.setField('balance', 30_000_000);
    s.setField('rate', 0.925);
    s.setField('remainingYears', 25);
    const input = useMortgageStore.getState().input;
    expect(input.calculatedMonthlyPayment).toBeGreaterThan(0);
    expect(input.monthlyPayment).toBe(input.calculatedMonthlyPayment);
    expect(input.monthlyPaymentSource).toBe('auto');
  });

  it('毎月返済額を手動修正すると monthlyPaymentSource が manual になる', () => {
    const s = useMortgageStore.getState();
    s.setField('balance', 30_000_000);
    s.setField('remainingYears', 25);
    s.setMonthlyPayment(110_000);
    let input = useMortgageStore.getState().input;
    expect(input.monthlyPayment).toBe(110_000);
    expect(input.monthlyPaymentSource).toBe('manual');

    // manual の間は前提変更でも毎月返済額は上書きされない（参考値だけ更新）
    s.setField('balance', 40_000_000);
    input = useMortgageStore.getState().input;
    expect(input.monthlyPayment).toBe(110_000);
    expect(input.calculatedMonthlyPayment).toBeGreaterThan(0);

    // 「目安に戻す」で自動値へ復帰
    s.useAutoMonthly();
    input = useMortgageStore.getState().input;
    expect(input.monthlyPaymentSource).toBe('auto');
    expect(input.monthlyPayment).toBe(input.calculatedMonthlyPayment);
  });

  it('毎月返済額を空にすると auto へ戻る', () => {
    const s = useMortgageStore.getState();
    s.setField('balance', 30_000_000);
    s.setField('remainingYears', 25);
    s.setMonthlyPayment(110_000);
    s.setMonthlyPayment(null);
    const input = useMortgageStore.getState().input;
    expect(input.monthlyPaymentSource).toBe('auto');
    expect(input.monthlyPayment).toBe(input.calculatedMonthlyPayment);
  });
});
