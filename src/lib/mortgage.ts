// 住宅ローンの簡易試算ロジック（純粋関数）。
// UI / ストアに一切依存しない。すべての入力は 0 / 負値 / NaN / null に対して
// 安全に振る舞い、Infinity や NaN を返さないことを保証する。

import type {
  MortgageInput,
  MortgageResult,
  RateScenario,
} from '../types/mortgage';

/**
 * 数値を安全な非負の有限数へ正規化する。
 * null / undefined / NaN / Infinity / 負値はすべて 0 に丸める。
 */
export function safeNumber(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value) || value < 0) return 0;
  return value;
}

/** 年間返済額 = 毎月返済額 × 12 + ボーナス返済 年額 */
export function annualPayment(
  monthlyPayment: number | null | undefined,
  bonusAnnual: number | null | undefined,
): number {
  return safeNumber(monthlyPayment) * 12 + safeNumber(bonusAnnual);
}

/** 完済予定年齢 = 現在年齢 + 残り返済年数 */
export function payoffAge(
  currentAge: number | null | undefined,
  remainingYears: number | null | undefined,
): number {
  return safeNumber(currentAge) + safeNumber(remainingYears);
}

/** 残り返済総額の概算 = 年間返済額 × 残り返済年数 */
export function remainingTotal(
  annual: number,
  remainingYears: number | null | undefined,
): number {
  return safeNumber(annual) * safeNumber(remainingYears);
}

/**
 * 元利均等返済の概算 月返済額。
 * balance: 残高（円）, annualRatePct: 年率 %, remainingYears: 残り年数。
 *
 * r = 月利, n = 返済回数（月）
 *   r === 0 → balance / n
 *   r  > 0 → balance * r * (1+r)^n / ((1+r)^n - 1)
 *
 * 厳密な金融機関の返済額と一致させる必要はない（生活設計用の概算）。
 */
export function equalInstallmentMonthly(
  balance: number | null | undefined,
  annualRatePct: number | null | undefined,
  remainingYears: number | null | undefined,
): number {
  const principal = safeNumber(balance);
  const years = safeNumber(remainingYears);
  const ratePct = safeNumber(annualRatePct);

  const n = Math.round(years * 12);
  if (principal === 0 || n === 0) return 0;

  const r = ratePct / 100 / 12;
  if (r === 0) return principal / n;

  const pow = Math.pow(1 + r, n);
  const denominator = pow - 1;
  if (denominator === 0) return principal / n; // 数値的な縮退への保険
  const payment = (principal * r * pow) / denominator;

  return Number.isFinite(payment) ? payment : 0;
}

/** 入力一式から結果の主指標をまとめて計算する。 */
export function computeResult(input: MortgageInput): MortgageResult {
  const annual = annualPayment(input.monthlyPayment, input.bonusAnnual);
  return {
    annualPayment: annual,
    payoffAge: payoffAge(input.currentAge, input.remainingYears),
    remainingTotal: remainingTotal(annual, input.remainingYears),
    referenceMonthly: equalInstallmentMonthly(
      input.balance,
      input.rate,
      input.remainingYears,
    ),
  };
}

/**
 * 金利を deltaPct だけ動かしたときの参考影響。
 * 増加分は基準金利の元利均等概算との差として算出し、金利変化の効果のみを切り出す。
 */
export function rateScenario(
  balance: number | null | undefined,
  baseRatePct: number | null | undefined,
  remainingYears: number | null | undefined,
  deltaPct: number,
): RateScenario {
  const base = safeNumber(baseRatePct);
  const years = safeNumber(remainingYears);
  const newRate = Math.max(0, base + deltaPct);

  const baseMonthly = equalInstallmentMonthly(balance, base, years);
  const newMonthly = equalInstallmentMonthly(balance, newRate, years);

  const monthlyIncrease = newMonthly - baseMonthly;
  const annualIncrease = monthlyIncrease * 12;
  const remainingTotalIncrease = annualIncrease * years;

  return {
    deltaPct,
    newRate,
    referenceMonthly: newMonthly,
    monthlyIncrease,
    annualIncrease,
    remainingTotalIncrease,
  };
}

/** 金利を絶対値 newRatePct に設定したときの参考影響（ステッパー用）。 */
export function rateScenarioAt(
  balance: number | null | undefined,
  baseRatePct: number | null | undefined,
  remainingYears: number | null | undefined,
  newRatePct: number,
): RateScenario {
  const base = safeNumber(baseRatePct);
  const target = Math.max(0, newRatePct);
  return rateScenario(balance, baseRatePct, remainingYears, target - base);
}
