// localStorage 連携。将来的に総合版（life-plan-lab）へ住宅ローン条件を
// 引き継げるよう、わかりやすい固定スキーマで保存する。

import type { MortgageInput, SavedMortgage } from '../types/mortgage';
import { safeNumber } from './mortgage';

/** 保存キー。総合版はこのキーを読みに来る想定。 */
export const STORAGE_KEY = 'lifePlanLab:mortgage';

/**
 * 入力一式を保存用スキーマへ変換する（純粋関数, テスト容易）。
 * 数値は安全に正規化し、null を 0 に落とす。保存する rate は入力の現在金利
 * （結果画面の試算用一時金利ではない）。
 */
export function buildSavedMortgage(
  input: MortgageInput,
  savedAt: string = new Date().toISOString(),
): SavedMortgage {
  return {
    version: 1,
    source: 'mortgage-simulator',
    savedAt,
    mortgage: {
      balance: safeNumber(input.balance),
      monthlyPayment: safeNumber(input.monthlyPayment),
      bonusAnnual: safeNumber(input.bonusAnnual),
      remainingYears: safeNumber(input.remainingYears),
      rate: safeNumber(input.rate),
      rateType: input.rateType,
      repayMethod: input.repayMethod,
    },
  };
}

/**
 * 入力を localStorage へ保存する。成功したら true。
 * 利用不可環境（プライベートモード等）でも例外で落とさない。
 */
export function saveMortgage(input: MortgageInput): boolean {
  try {
    const payload = buildSavedMortgage(input);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/** 保存済みデータを読み出す（無ければ null）。総合版側の参考実装も兼ねる。 */
export function loadMortgage(): SavedMortgage | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedMortgage;
  } catch {
    return null;
  }
}
