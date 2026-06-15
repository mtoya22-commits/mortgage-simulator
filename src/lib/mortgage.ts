// 住宅ローンの簡易試算ロジック（純粋関数）。
// UI / ストアに一切依存しない。すべての入力は 0 / 負値 / NaN / null に対して
// 安全に振る舞い、Infinity や NaN を返さないことを保証する。

import type {
  MortgageInput,
  MortgageResult,
  RateScenario,
  RepayMethod,
  AmortizationSchedule,
  AmortPoint,
  FixedPeriodImpact,
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

/**
 * 元金均等返済の初回付近 月返済額。
 * 毎月の元金 = 残高 / n（一定）、初回利息 = 残高 × 月利。初回が最も大きい。
 */
export function equalPrincipalFirstMonthly(
  balance: number | null | undefined,
  annualRatePct: number | null | undefined,
  remainingYears: number | null | undefined,
): number {
  const principal = safeNumber(balance);
  const years = safeNumber(remainingYears);
  const n = Math.round(years * 12);
  if (principal === 0 || n === 0) return 0;

  const r = safeNumber(annualRatePct) / 100 / 12;
  const value = principal / n + principal * r;
  return Number.isFinite(value) ? value : 0;
}

/**
 * 元金均等返済の平均 月返済額。
 * 利息合計 = r × 残高 × (n+1) / 2（等差数列の和）。平均 = (残高 + 利息合計) / n。
 * 金利 0% でも 残高 / n を返す。
 */
export function equalPrincipalAverageMonthly(
  balance: number | null | undefined,
  annualRatePct: number | null | undefined,
  remainingYears: number | null | undefined,
): number {
  const principal = safeNumber(balance);
  const years = safeNumber(remainingYears);
  const n = Math.round(years * 12);
  if (principal === 0 || n === 0) return 0;

  const r = safeNumber(annualRatePct) / 100 / 12;
  const totalInterest = (r * principal * (n + 1)) / 2;
  const value = (principal + totalInterest) / n;
  return Number.isFinite(value) ? value : 0;
}

/**
 * 返済方式準拠の参考月返済額。
 * 元利均等 → 元利均等概算、元金均等 → 平均月額（自動初期値・主指標に使用）。
 */
export function referenceMonthlyByMethod(
  balance: number | null | undefined,
  annualRatePct: number | null | undefined,
  remainingYears: number | null | undefined,
  method: RepayMethod,
): number {
  return method === 'equal-principal'
    ? equalPrincipalAverageMonthly(balance, annualRatePct, remainingYears)
    : equalInstallmentMonthly(balance, annualRatePct, remainingYears);
}

/** 入力一式から結果の主指標をまとめて計算する。 */
export function computeResult(input: MortgageInput): MortgageResult {
  const annual = annualPayment(input.monthlyPayment, input.bonusAnnual);
  const first = equalPrincipalFirstMonthly(input.balance, input.rate, input.remainingYears);
  const average = equalPrincipalAverageMonthly(input.balance, input.rate, input.remainingYears);
  const installment = equalInstallmentMonthly(input.balance, input.rate, input.remainingYears);

  return {
    annualPayment: annual,
    payoffAge: payoffAge(input.currentAge, input.remainingYears),
    remainingTotal: remainingTotal(annual, input.remainingYears),
    referenceMonthly:
      input.repayMethod === 'equal-principal' ? average : installment,
    referenceMonthlyFirst: input.repayMethod === 'equal-principal' ? first : installment,
    referenceMonthlyAverage: input.repayMethod === 'equal-principal' ? average : installment,
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
  method: RepayMethod = 'equal-payment',
): RateScenario {
  const base = safeNumber(baseRatePct);
  const years = safeNumber(remainingYears);
  const newRate = Math.max(0, base + deltaPct);

  const baseMonthly = referenceMonthlyByMethod(balance, base, years, method);
  const newMonthly = referenceMonthlyByMethod(balance, newRate, years, method);

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
  method: RepayMethod = 'equal-payment',
): RateScenario {
  const base = safeNumber(baseRatePct);
  const target = Math.max(0, newRatePct);
  return rateScenario(balance, baseRatePct, remainingYears, target - base, method);
}

/** 固定期間の残り年数が返済期間を超えているか（やさしいエラー判定用）。 */
export function fixedPeriodExceedsTerm(input: MortgageInput): boolean {
  if (input.rateType !== 'fixed-period') return false;
  const fixed = input.fixedPeriodRemainingYears;
  const total = input.remainingYears;
  if (fixed == null || total == null) return false;
  return safeNumber(fixed) > safeNumber(total);
}

interface RunResult {
  points: AmortPoint[];
  payoffYear: number | null;
  fixedPeriodEndYear: number | null;
  /** 返済期間 n 月内に残高が ~0 に到達したか（手動額ベース採否の判定に使う） */
  amortized: boolean;
}

/**
 * 月次シミュレーションの実体（表示は年次点のみ）。
 *
 * - equal-payment: 支払額 = 参考の元利均等概算。固定期間終了月で金利を postFixedRate に切替え、
 *   残元金・残月数で支払を再計算。`monthlyOverride` を渡すと（元利均等のみ）その額を全期間一定の
 *   支払額として使う（＝入力した毎月返済額ベース。固定期間でも額は一定）。
 * - equal-principal: 毎月の元金 = 初期残高 / n 一定、利息 = 残高 × 月利（金利は区間で切替）。
 * - ボーナス: bonusAnnual を年 1 回（各年末）の追加元金返済として残高から概算減算。
 * - 残高は 0 未満にせず、完済後は 0 で停止する。
 */
function runSchedule(input: MortgageInput, monthlyOverride: number | null): RunResult {
  const principal0 = safeNumber(input.balance);
  const totalYears = Math.max(0, Math.round(safeNumber(input.remainingYears)));
  const baseAge = safeNumber(input.currentAge);
  const bonus = safeNumber(input.bonusAnnual);
  const method = input.repayMethod;

  const n = totalYears * 12;

  // 固定期間終了月（固定期間選択型かつ終了後金利が入力済みのときのみ金利を切替）
  const useFixed =
    input.rateType === 'fixed-period' &&
    input.postFixedRate != null &&
    safeNumber(input.fixedPeriodRemainingYears) > 0;
  const fixedEndMonth = useFixed
    ? Math.round(safeNumber(input.fixedPeriodRemainingYears) * 12)
    : null;
  const fixedPeriodEndYear =
    input.rateType === 'fixed-period' && safeNumber(input.fixedPeriodRemainingYears) > 0
      ? Math.round(safeNumber(input.fixedPeriodRemainingYears))
      : null;

  const rateAtMonth = (monthIndex: number): number => {
    // monthIndex は 1 始まり。固定期間終了後は postFixedRate を使う。
    if (fixedEndMonth != null && monthIndex > fixedEndMonth) {
      return safeNumber(input.postFixedRate) / 100 / 12;
    }
    return safeNumber(input.rate) / 100 / 12;
  };

  const points: AmortPoint[] = [{ year: 0, age: baseAge, balance: principal0 }];

  // 計算不能（残高/年数が 0）の場合は現在点のみ返す
  if (principal0 === 0 || n === 0) {
    return {
      points,
      payoffYear: principal0 === 0 ? 0 : null,
      fixedPeriodEndYear,
      amortized: principal0 === 0,
    };
  }

  let balance = principal0;
  let payoffYear: number | null = null;

  // 入力した毎月返済額ベース（元利均等のみ。全期間一定）
  const useOverride =
    monthlyOverride != null && monthlyOverride > 0 && method === 'equal-payment';

  // equal-payment は区間ごとに支払額を再計算する。初期区間の支払額を求める。
  const equalPrincipalPortion = principal0 / n; // 元金均等の毎月元金（一定）
  let payment = useOverride
    ? monthlyOverride
    : equalInstallmentMonthly(principal0, input.rate, totalYears);

  for (let m = 1; m <= n && balance > 0; m++) {
    const r = rateAtMonth(m);

    // 固定期間終了の月に達したら equal-payment は残元金・残月数で支払を組み直す
    // （ただし入力額ベースのときは一定額を維持する）
    if (
      method === 'equal-payment' &&
      !useOverride &&
      fixedEndMonth != null &&
      m === fixedEndMonth + 1
    ) {
      const remainingMonths = n - fixedEndMonth;
      const postYears = remainingMonths / 12;
      payment = equalInstallmentMonthly(balance, safeNumber(input.postFixedRate), postYears);
    }

    const interest = balance * r;
    let principalPaid: number;
    if (method === 'equal-principal') {
      principalPaid = equalPrincipalPortion;
    } else {
      principalPaid = payment - interest;
      // 金利が高すぎて元金が進まない概算崩れを防ぐ下限
      if (principalPaid < 0) principalPaid = 0;
    }

    balance = balance - principalPaid;

    // 年末にボーナスを追加元金として概算反映
    if (bonus > 0 && m % 12 === 0) {
      balance -= bonus;
    }

    if (balance < 0) balance = 0;

    // 年末（または最終月）に年次点を記録
    if (m % 12 === 0) {
      const year = m / 12;
      points.push({ year, age: baseAge + year, balance });
      if (balance === 0 && payoffYear == null) payoffYear = year;
    } else if (balance === 0 && payoffYear == null) {
      // 年の途中で完済した場合、その年（切り上げ）を完済年とし点を打つ
      const year = Math.ceil(m / 12);
      if (points[points.length - 1]?.year !== year) {
        points.push({ year, age: baseAge + year, balance: 0 });
      }
      payoffYear = year;
    }
  }

  // 返済期間内に完済したか（端数補正の前に実残高で判定）
  const amortized = balance <= principal0 * 1e-6;

  // ボーナス未反映等で端数が残った場合、最終年に 0 点を補う（完済予定年数で打ち切り）
  const last = points[points.length - 1];
  if (amortized && last && last.balance > 0 && last.year >= totalYears) {
    points.push({ year: totalYears, age: baseAge + totalYears, balance: 0 });
  }

  return { points, payoffYear, fixedPeriodEndYear, amortized };
}

/**
 * 1 年ごとの残高推移を生成する。
 *
 * 既定は参考月返済額（残高・金利・残り年数・返済方式から計算）ベース。
 * ただし返済方式が元利均等で毎月返済額が手動修正済みのときは、その入力額ベースを試み、
 * 返済期間内に完済する場合のみ採用する（生活設計上の実支出に近づけるため）。
 * 完済しない／元金均等／自動計算のままの場合は参考ベースへフォールバックする。
 */
export function buildAmortizationSchedule(input: MortgageInput): AmortizationSchedule {
  const eligible =
    input.repayMethod === 'equal-payment' &&
    input.monthlyPaymentSource === 'manual' &&
    safeNumber(input.monthlyPayment) > 0;

  if (eligible) {
    const tryInput = runSchedule(input, safeNumber(input.monthlyPayment));
    if (tryInput.amortized) {
      return {
        points: tryInput.points,
        payoffYear: tryInput.payoffYear,
        fixedPeriodEndYear: tryInput.fixedPeriodEndYear,
        paymentBasis: 'input',
        inputPaymentFellBack: false,
      };
    }
    // 入力額では期間内に完済しない概算 → 参考ベースへフォールバック
    const ref = runSchedule(input, null);
    return {
      points: ref.points,
      payoffYear: ref.payoffYear,
      fixedPeriodEndYear: ref.fixedPeriodEndYear,
      paymentBasis: 'reference',
      inputPaymentFellBack: true,
    };
  }

  const ref = runSchedule(input, null);
  return {
    points: ref.points,
    payoffYear: ref.payoffYear,
    fixedPeriodEndYear: ref.fixedPeriodEndYear,
    paymentBasis: 'reference',
    inputPaymentFellBack: false,
  };
}

/**
 * 固定期間選択型: 固定期間終了後の参考影響。
 * 終了後想定金利（postFixedRate）が未入力なら configured:false。
 */
export function fixedPeriodImpact(input: MortgageInput): FixedPeriodImpact {
  const baseAge = safeNumber(input.currentAge);
  const fixedYears = safeNumber(input.fixedPeriodRemainingYears);
  const totalYears = safeNumber(input.remainingYears);
  const endAge = baseAge + fixedYears;

  const configured =
    input.rateType === 'fixed-period' &&
    input.postFixedRate != null &&
    fixedYears > 0 &&
    fixedYears < totalYears;

  if (!configured) {
    return {
      configured: false,
      endAge,
      balanceAtEnd: 0,
      postRate: safeNumber(input.postFixedRate),
      postMonthly: 0,
      monthlyIncrease: 0,
      annualIncrease: 0,
    };
  }

  // 固定期間終了時点の残高をスケジュールから取得
  const schedule = buildAmortizationSchedule(input);
  const endPoint = schedule.points.find((p) => p.year === Math.round(fixedYears));
  const balanceAtEnd = endPoint ? endPoint.balance : 0;

  const postRate = safeNumber(input.postFixedRate);
  const remainingAfter = totalYears - fixedYears;
  const postMonthly = referenceMonthlyByMethod(
    balanceAtEnd,
    postRate,
    remainingAfter,
    input.repayMethod,
  );

  // 現在の参考月返済額（同じ方式）との差
  const currentMonthly = referenceMonthlyByMethod(
    input.balance,
    input.rate,
    input.remainingYears,
    input.repayMethod,
  );
  const monthlyIncrease = postMonthly - currentMonthly;

  return {
    configured: true,
    endAge,
    balanceAtEnd,
    postRate,
    postMonthly,
    monthlyIncrease,
    annualIncrease: monthlyIncrease * 12,
  };
}
