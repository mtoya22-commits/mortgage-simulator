// 住宅ローンシミュレーターの型定義。
// UI からも計算ロジックからも参照される共通の語彙をここに集約する。

/** 金利タイプ（MVP では表示・説明用。計算分岐には使わない） */
export type RateType = 'variable' | 'fixed' | 'fixed-period';

/** 返済方式（MVP では参考情報扱い。厳密な返済表は作らない） */
export type RepayMethod = 'equal-payment' | 'equal-principal';

/**
 * 入力状態。
 * 数値は「未入力」を表現できるよう number | null で保持し、
 * 計算時に純粋関数側で 0 等へ正規化する（安全処理は計算層に集約）。
 */
export interface MortgageInput {
  /** 現在年齢（歳） */
  currentAge: number | null;
  /** 住宅ローン残高（円） */
  balance: number | null;
  /** 現在の金利（年率 %） */
  rate: number | null;
  /** 金利タイプ */
  rateType: RateType;
  /** 毎月返済額（円） */
  monthlyPayment: number | null;
  /** ボーナス返済 年額（円） */
  bonusAnnual: number | null;
  /** 残り返済年数（年） */
  remainingYears: number | null;
  /** 返済方式 */
  repayMethod: RepayMethod;
}

/** 結果画面の主指標（簡易試算） */
export interface MortgageResult {
  /** 年間返済額（円） = 毎月返済額 × 12 + ボーナス返済年額 */
  annualPayment: number;
  /** 完済予定年齢（歳） = 現在年齢 + 残り返済年数 */
  payoffAge: number;
  /** 残り返済総額の概算（円） = 年間返済額 × 残り返済年数 */
  remainingTotal: number;
  /** 残高・残り年数・現在金利からの元利均等 概算月返済額（参考） */
  referenceMonthly: number;
}

/**
 * 金利を delta だけ動かしたときの参考影響。
 * 増加分は「金利効果」を切り出すため、元利均等概算どうしの差で算出する。
 */
export interface RateScenario {
  /** 適用した金利の増分（%ポイント） */
  deltaPct: number;
  /** 動かした後の金利（年率 %） */
  newRate: number;
  /** 新金利での参考月返済額（元利均等概算, 円） */
  referenceMonthly: number;
  /** 基準金利の参考月返済額との差（円 / 月） */
  monthlyIncrease: number;
  /** 年間負担増の目安（円 / 年） */
  annualIncrease: number;
  /** 残り返済総額への影響の目安（円） */
  remainingTotalIncrease: number;
}

/** localStorage 保存形式（総合版へ引き継ぐためのスキーマ） */
export interface SavedMortgage {
  version: 1;
  source: 'mortgage-simulator';
  savedAt: string; // ISO 文字列
  mortgage: {
    balance: number;
    monthlyPayment: number;
    bonusAnnual: number;
    remainingYears: number;
    rate: number;
    rateType: RateType;
    repayMethod: RepayMethod;
  };
}
