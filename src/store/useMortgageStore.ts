// アプリの状態管理（zustand 単一ストア）。
// phase 遷移（intro → input → result）と入力状態を保持する。
// DESIGN_HANDOFF.md 5章の規約に合わせた極小ストア。

import { create } from 'zustand';
import type { MortgageInput } from '../types/mortgage';

export type Phase = 'intro' | 'input' | 'result';

/** 初期入力。数値は未入力（null）から始める。選択肢は穏当な既定値を置く。 */
export const initialInput: MortgageInput = {
  currentAge: null,
  balance: null,
  rate: null,
  rateType: 'variable',
  monthlyPayment: null,
  bonusAnnual: null,
  remainingYears: null,
  repayMethod: 'equal-payment',
};

interface MortgageStore {
  phase: Phase;
  input: MortgageInput;

  goTo: (phase: Phase) => void;
  /** 1 項目を更新（単位変換が必要なら呼び出し側ではなくここで吸収する余地を残す）。 */
  setField: <K extends keyof MortgageInput>(
    key: K,
    value: MortgageInput[K],
  ) => void;
  reset: () => void;
}

export const useMortgageStore = create<MortgageStore>((set) => ({
  phase: 'intro',
  input: initialInput,

  goTo: (phase) => set({ phase }),
  setField: (key, value) =>
    set((state) => ({ input: { ...state.input, [key]: value } })),
  reset: () => set({ phase: 'intro', input: initialInput }),
}));
