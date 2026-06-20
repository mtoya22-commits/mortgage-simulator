// 住宅ローンシミュレーターの型定義。
// UI からも計算ロジックからも参照される共通の語彙をここに集約する。

/** 金利タイプ（MVP では表示・説明用。計算分岐には使わない） */
export type RateType = 'variable' | 'fixed' | 'fixed-period';

/** 返済方式（MVP では参考情報扱い。厳密な返済表は作らない） */
export type RepayMethod = 'equal-payment' | 'equal-principal';

/** 毎月返済額の由来。auto=自動計算値をそのまま使用、manual=ユーザー手動修正 */
export type MonthlyPaymentSource = 'auto' | 'manual';

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
  /** 毎月返済額（円）。生活設計へ反映する最終値（auto/manual いずれか） */
  monthlyPayment: number | null;
  /** 残高・金利・残り年数・返済方式から自動計算した参考月返済額（円） */
  calculatedMonthlyPayment: number | null;
  /** 毎月返済額の由来 */
  monthlyPaymentSource: MonthlyPaymentSource;
  /** ボーナス返済 年額（円） */
  bonusAnnual: number | null;
  /** 残り返済年数（年） */
  remainingYears: number | null;
  /** 返済方式 */
  repayMethod: RepayMethod;
  /** 固定期間選択型: 固定期間の残り年数（年） */
  fixedPeriodRemainingYears: number | null;
  /** 固定期間選択型: 固定期間終了後の想定金利（年率 %） */
  postFixedRate: number | null;
}

/** 結果画面の主指標（簡易試算） */
export interface MortgageResult {
  /** 年間返済額（円） = 毎月返済額 × 12 + ボーナス返済年額 */
  annualPayment: number;
  /** 完済予定年齢（歳） = 現在年齢 + 残り返済年数 */
  payoffAge: number;
  /** 残り返済総額の概算（円）。返済スケジュールから算出した累計返済額（= 残高 + 総支払利息） */
  remainingTotal: number;
  /** 現在条件の総支払利息の概算（円） */
  totalInterest: number;
  /** 返済方式準拠の参考月返済額（元利均等=概算月額 / 元金均等=初回付近） */
  referenceMonthly: number;
  /** 元金均等の初回付近 月返済額（元利均等では referenceMonthly と一致） */
  referenceMonthlyFirst: number;
  /** 元金均等の平均 月返済額（元利均等では referenceMonthly と一致） */
  referenceMonthlyAverage: number;
}

/** 残高推移グラフの 1 年ごとの点 */
export interface AmortPoint {
  /** 経過年数（0 = 現在） */
  year: number;
  /** その年の年齢（現在年齢 + year） */
  age: number;
  /** その年末時点の残高（円, 0 未満にしない） */
  balance: number;
}

/** 1 年ごとの返済額の内訳（円/月・年内平均、スケジュール返済のみ＝ボーナス除外） */
export interface PaymentYear {
  /** 経過年数（1 始まり） */
  year: number;
  /** その年の年齢 */
  age: number;
  /** 元金部分の毎月返済額（円/月, 概算） */
  principal: number;
  /** 利息部分の毎月返済額（円/月, 概算） */
  interest: number;
}

/** 1 年ごとの残高推移（内部の月次シミュレーションから生成） */
export interface AmortizationSchedule {
  points: AmortPoint[];
  /** 残高が 0 になる経過年数（完済しない場合 null） */
  payoffYear: number | null;
  /** 固定期間が終了する経過年数（固定期間選択型のみ, それ以外 null） */
  fixedPeriodEndYear: number | null;
  /** 描画に使った返済額の種類（reference=参考月返済額 / input=入力した毎月返済額） */
  paymentBasis: 'reference' | 'input';
  /** 入力した毎月返済額での試算を試みたが、参考ベースへ戻したか */
  inputPaymentFellBack: boolean;
  /** 現在の残高から完済までに支払う利息の概算（円） */
  totalInterest: number;
  /** 1 年ごとの返済額の内訳（元金・利息, 円/月） */
  breakdown: PaymentYear[];
}

/** 現在の残高から完済までの総額の概算（円）。 */
export interface PaymentTotals {
  /** 総支払利息の概算 */
  totalInterest: number;
  /** 総返済額の概算（= 残高 + 総支払利息） */
  totalPayment: number;
  /** 完済予定の経過年数（完済しない場合 null） */
  payoffYear: number | null;
}

/** 入力した毎月返済額と参考月返済額の乖離 */
export interface MonthlyDivergence {
  /** 計算した参考月返済額（返済方式準拠） */
  referenceMonthly: number;
  /** 入力した毎月返済額 */
  inputMonthly: number;
  /** 差（入力 − 参考） */
  diff: number;
  /** 注意表示を出すべき大きな乖離か */
  significant: boolean;
}

/** 固定期間選択型: 固定期間終了後の参考影響 */
export interface FixedPeriodImpact {
  /** 終了後想定金利が入力済みで試算できたか */
  configured: boolean;
  /** 固定期間終了時の年齢（歳） */
  endAge: number;
  /** 固定期間終了時点のローン残高の目安（円） */
  balanceAtEnd: number;
  /** 固定期間終了後の想定金利（年率 %） */
  postRate: number;
  /** 固定期間終了後の参考月返済額（返済方式準拠, 円） */
  postMonthly: number;
  /** 現在の参考月返済額との差（円 / 月） */
  monthlyIncrease: number;
  /** 年間負担増の目安（円 / 年） */
  annualIncrease: number;
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

/**
 * 総合版へ反映する条件の選択元。
 * currentPlan=現在の返済条件 / rateAdjusted=金利変更シナリオ / fixedPeriodScenario=固定期間終了後シナリオ。
 */
export type MortgageSource = 'currentPlan' | 'rateAdjusted' | 'fixedPeriodScenario';

/** 保存ペイロード用の返済方式表記（総合版が読む語彙）。 */
export type PayloadRepaymentMethod = 'equalPayment' | 'equalPrincipal' | 'unknown';

/** 保存ペイロード用の金利タイプ表記（総合版が読む語彙）。 */
export type PayloadRateType = 'variable' | 'fixed' | 'fixedPeriod' | 'unknown';

/**
 * localStorage `lifePlanLab:mortgage` の確定データ。
 * 総合版（life-plan-lab）が読み取る、生活設計用の住宅ローン条件。
 * 金額は円、金利は % 表記、年数は年で統一する。
 */
export interface MortgagePayload {
  /** 総合版へ反映する毎月返済額（円/月） */
  selectedMonthlyPaymentYen: number;
  /** 年間返済額（円/年）＝ selectedMonthly × 12 + ボーナス年額 */
  selectedAnnualPaymentYen: number;
  /** どの条件を選んだか */
  selectedSource: MortgageSource;
  /** 住宅ローン残高（円） */
  balanceYen: number;
  /** 現在金利（% 表記。例 0.925） */
  interestRate: number;
  /** 残り返済年数（年） */
  remainingYears: number;
  /** 返済方式 */
  repaymentMethod: PayloadRepaymentMethod;
  /** 現在の毎月返済額（円/月） */
  monthlyPaymentYen: number;
  /** ボーナス返済年額（円/年） */
  bonusAnnualYen?: number;
  /** 金利タイプ */
  rateType?: PayloadRateType;
  /** 固定期間の残り年数（固定期間選択型のみ） */
  fixedPeriodRemainingYears?: number;
  /** 固定期間終了後の想定金利（固定期間選択型のみ, % 表記） */
  afterFixedRate?: number;
  /** 金利調整や固定期間終了後などの試算月返済額（円/月） */
  scenarioMonthlyPaymentYen?: number;
  /** 試算に使った金利（% 表記） */
  scenarioInterestRate?: number;
  /** 試算の表示名 */
  scenarioLabel?: string;
  /** 保存時刻（ISO 文字列） */
  savedAt: string;
  /** スキーマ版数 */
  version: number;
}
