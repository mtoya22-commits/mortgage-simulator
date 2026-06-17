// アプリの状態管理（zustand 単一ストア）。
// phase 遷移（intro → input → result）と入力状態を保持する。
// DESIGN_HANDOFF.md 5章の規約に合わせた極小ストア。

import { create } from 'zustand';
import type { MortgageInput } from '../types/mortgage';
import { referenceMonthlyByMethod } from '../lib/mortgage';
import { saveMortgageDraft } from '../lib/storage';

export type Phase = 'intro' | 'input' | 'result';

/** 初期入力。数値は未入力（null）から始める。選択肢は穏当な既定値を置く。 */
export const initialInput: MortgageInput = {
  currentAge: null,
  balance: null,
  rate: null,
  rateType: 'variable',
  monthlyPayment: null,
  calculatedMonthlyPayment: null,
  monthlyPaymentSource: 'auto',
  bonusAnnual: null,
  remainingYears: null,
  repayMethod: 'equal-payment',
  fixedPeriodRemainingYears: null,
  postFixedRate: null,
};

/** 毎月返済額の自動計算に影響する入力キー。これらが変わると auto 値を再計算する。 */
const AUTO_TRIGGER_KEYS: (keyof MortgageInput)[] = [
  'balance',
  'rate',
  'remainingYears',
  'repayMethod',
];

/**
 * 残高・金利・残り年数・返済方式から参考月返済額を計算する。
 * 算出できない（残高/年数が無い）場合は null を返す。
 */
function calcAutoMonthly(input: MortgageInput): number | null {
  if (!input.balance || !input.remainingYears) return null;
  const value = referenceMonthlyByMethod(
    input.balance,
    input.rate,
    input.remainingYears,
    input.repayMethod,
  );
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

interface MortgageStore {
  phase: Phase;
  input: MortgageInput;

  goTo: (phase: Phase) => void;
  /** 1 項目を更新。前提項目が変わり source==='auto' なら毎月返済額を自動追従する。 */
  setField: <K extends keyof MortgageInput>(
    key: K,
    value: MortgageInput[K],
  ) => void;
  /** 毎月返済額の手動修正。空にすると auto へ戻す。 */
  setMonthlyPayment: (value: number | null) => void;
  /** 「目安に戻す」: 自動計算値へ戻す。 */
  useAutoMonthly: () => void;
  reset: () => void;
}

export const useMortgageStore = create<MortgageStore>((set) => ({
  phase: 'intro',
  input: initialInput,

  goTo: (phase) => set({ phase }),

  setField: (key, value) =>
    set((state) => {
      const next: MortgageInput = { ...state.input, [key]: value };

      if (AUTO_TRIGGER_KEYS.includes(key)) {
        const auto = calcAutoMonthly(next);
        next.calculatedMonthlyPayment = auto;
        // 手動修正されていなければ毎月返済額を自動値に追従させる
        if (next.monthlyPaymentSource === 'auto') {
          next.monthlyPayment = auto;
        }
      }

      saveMortgageDraft(next); // 入力途中の下書きを自動保存（確定キーとは別）
      return { input: next };
    }),

  setMonthlyPayment: (value) =>
    set((state) => {
      let next: MortgageInput;
      if (value == null) {
        // 空にしたら自動計算へ戻す
        const auto = state.input.calculatedMonthlyPayment ?? calcAutoMonthly(state.input);
        next = {
          ...state.input,
          monthlyPaymentSource: 'auto',
          calculatedMonthlyPayment: auto,
          monthlyPayment: auto,
        };
      } else {
        next = { ...state.input, monthlyPayment: value, monthlyPaymentSource: 'manual' };
      }
      saveMortgageDraft(next);
      return { input: next };
    }),

  useAutoMonthly: () =>
    set((state) => {
      const auto = calcAutoMonthly(state.input);
      const next: MortgageInput = {
        ...state.input,
        monthlyPaymentSource: 'auto',
        calculatedMonthlyPayment: auto,
        monthlyPayment: auto,
      };
      saveMortgageDraft(next);
      return { input: next };
    }),

  reset: () => set({ phase: 'intro', input: initialInput }),
}));
