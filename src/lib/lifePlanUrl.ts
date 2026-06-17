// 総合版（life-plan-lab）リンクへ住宅ローン条件を URL パラメータで付与する。
// 別 origin で localStorage を共有できない場合の補助経路。
// パラメータ名は必ず `mortgage` プレフィックス付き。単位は 円 / % / 年。
// 不正値（NaN・0以下・非現実的な値）は付けない。

import type { MortgagePayload } from '../types/mortgage';

/** 円・年など「正の有限数」だけ採用。 */
function positiveInt(value: number): string | null {
  return Number.isFinite(value) && value > 0 ? String(Math.round(value)) : null;
}

/** 金利（% 表記）は 0〜20 の現実的な範囲のみ採用。 */
function rate(value: number): string | null {
  return Number.isFinite(value) && value >= 0 && value <= 20 ? String(value) : null;
}

/** 残り年数は 1〜50 の現実的な範囲のみ採用。 */
function years(value: number): string | null {
  return Number.isFinite(value) && value >= 1 && value <= 50 ? String(Math.round(value)) : null;
}

/**
 * 総合版 URL に mortgage* パラメータを付けて返す。
 * 値が不正な項目は付けない（「不正な値が URL に出ない」）。
 */
export function buildLifePlanUrl(baseUrl: string, payload: MortgagePayload): string {
  let url: URL;
  try {
    // 相対パスでも壊れないよう location を base に使う（ブラウザ外は絶対 URL 前提）
    const base =
      typeof window !== 'undefined' && window.location ? window.location.href : undefined;
    url = new URL(baseUrl, base);
  } catch {
    return baseUrl;
  }

  const p = url.searchParams;
  const set = (key: string, value: string | null) => {
    if (value != null) p.set(key, value);
  };

  set('mortgageMonthlyPaymentYen', positiveInt(payload.selectedMonthlyPaymentYen));
  set('mortgageAnnualPaymentYen', positiveInt(payload.selectedAnnualPaymentYen));
  set('mortgageBalanceYen', positiveInt(payload.balanceYen));
  set('mortgageInterestRate', rate(payload.interestRate));
  set('mortgageRemainingYears', years(payload.remainingYears));
  set('mortgageSource', payload.selectedSource);

  // 任意項目
  if (payload.bonusAnnualYen != null && payload.bonusAnnualYen > 0) {
    set('mortgageBonusAnnualYen', positiveInt(payload.bonusAnnualYen));
  }
  if (payload.repaymentMethod && payload.repaymentMethod !== 'unknown') {
    set('mortgageRepaymentMethod', payload.repaymentMethod);
  }
  if (payload.rateType && payload.rateType !== 'unknown') {
    set('mortgageRateType', payload.rateType);
  }

  return url.toString();
}
