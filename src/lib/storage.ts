// localStorage 連携。総合版（life-plan-lab）へ住宅ローン条件を引き継ぐための
// 確定データ（lifePlanLab:mortgage）と、入力途中の下書き（lifePlanLab:mortgageDraft）を扱う。
// この 2 つは用途が異なるので、キーを必ず分けて混同しない。

import type {
  MortgageInput,
  MortgagePayload,
  MortgageSource,
  PayloadRepaymentMethod,
  PayloadRateType,
} from '../types/mortgage';
import { safeNumber } from './mortgage';

/** 総合版へ渡す確定データのキー。総合版はこのキーを読みに来る。 */
export const STORAGE_KEY = 'lifePlanLab:mortgage';

/** 入力途中の下書きのキー（確定データとは別物）。 */
export const DRAFT_STORAGE_KEY = 'lifePlanLab:mortgageDraft';

/** ペイロードのスキーマ版数。 */
export const PAYLOAD_VERSION = 1;

/** 返済方式を総合版が読む語彙へ変換。 */
export function toPayloadRepayMethod(
  method: MortgageInput['repayMethod'],
): PayloadRepaymentMethod {
  if (method === 'equal-payment') return 'equalPayment';
  if (method === 'equal-principal') return 'equalPrincipal';
  return 'unknown';
}

/** 金利タイプを総合版が読む語彙へ変換。 */
export function toPayloadRateType(rateType: MortgageInput['rateType']): PayloadRateType {
  if (rateType === 'variable') return 'variable';
  if (rateType === 'fixed') return 'fixed';
  if (rateType === 'fixed-period') return 'fixedPeriod';
  return 'unknown';
}

/** 反映ボタン押下時に渡す、選択された条件。 */
export interface ScenarioSelection {
  source: MortgageSource;
  /** 総合版へ反映する毎月返済額（円/月） */
  selectedMonthlyYen: number;
  /** 試算月返済額（円/月。金利変更・固定期間終了後のとき） */
  scenarioMonthlyYen?: number;
  /** 試算金利（% 表記） */
  scenarioRate?: number;
  /** 試算の表示名 */
  scenarioLabel?: string;
}

/**
 * 入力一式と選択された条件から、保存用ペイロードを組み立てる（純粋関数, テスト容易）。
 * 金額は円、金利は % 表記、年数は年。固定期間項目は固定期間選択型のときだけ付ける。
 */
export function buildMortgagePayload(
  input: MortgageInput,
  selection: ScenarioSelection,
  savedAt: string = new Date().toISOString(),
): MortgagePayload {
  const bonus = safeNumber(input.bonusAnnual);
  const selectedMonthly = Math.round(safeNumber(selection.selectedMonthlyYen));
  const isFixedPeriod = input.rateType === 'fixed-period';

  return {
    selectedMonthlyPaymentYen: selectedMonthly,
    selectedAnnualPaymentYen: selectedMonthly * 12 + bonus,
    selectedSource: selection.source,
    balanceYen: safeNumber(input.balance),
    interestRate: safeNumber(input.rate),
    remainingYears: safeNumber(input.remainingYears),
    repaymentMethod: toPayloadRepayMethod(input.repayMethod),
    monthlyPaymentYen: safeNumber(input.monthlyPayment),
    bonusAnnualYen: bonus,
    rateType: toPayloadRateType(input.rateType),
    ...(isFixedPeriod && input.fixedPeriodRemainingYears != null
      ? { fixedPeriodRemainingYears: safeNumber(input.fixedPeriodRemainingYears) }
      : {}),
    ...(isFixedPeriod && input.postFixedRate != null
      ? { afterFixedRate: safeNumber(input.postFixedRate) }
      : {}),
    ...(selection.scenarioMonthlyYen != null
      ? { scenarioMonthlyPaymentYen: Math.round(safeNumber(selection.scenarioMonthlyYen)) }
      : {}),
    ...(selection.scenarioRate != null
      ? { scenarioInterestRate: safeNumber(selection.scenarioRate) }
      : {}),
    ...(selection.scenarioLabel ? { scenarioLabel: selection.scenarioLabel } : {}),
    savedAt,
    version: PAYLOAD_VERSION,
  };
}

/** 確定ペイロードを保存する（lifePlanLab:mortgage）。成功で true。 */
export function saveMortgagePayload(payload: MortgagePayload): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/** 確定ペイロードを読み出す（無ければ null）。 */
export function loadMortgagePayload(): MortgagePayload | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MortgagePayload;
  } catch {
    return null;
  }
}

/** 入力途中の下書きを保存する（lifePlanLab:mortgageDraft）。確定とは別キー。 */
export function saveMortgageDraft(input: MortgageInput): boolean {
  try {
    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({ version: PAYLOAD_VERSION, savedAt: new Date().toISOString(), input }),
    );
    return true;
  } catch {
    return false;
  }
}

/** 入力途中の下書きを読み出す（無ければ null）。 */
export function loadMortgageDraft(): MortgageInput | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { input?: MortgageInput };
    return parsed?.input ?? null;
  } catch {
    return null;
  }
}
