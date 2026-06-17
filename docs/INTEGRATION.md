# 総合版 life-plan-lab 受け取り実装（Stage 2 ハンドオフ）

住宅ローンシミュレーターが保存・付与した条件を、総合版「生活設計シミュレーター」で受け取るための
**リファレンス実装**です。総合版リポ（life-plan-lab）にこの設計で組み込んでください。本リポは変更不要。

受け渡し経路（二重）:
- **localStorage `lifePlanLab:mortgage`**（主）… 確定ペイロード（[README](../README.md) のスキーマ）。
- **URL パラメータ `mortgage*`**（補助）… 別 origin で localStorage を共有できない場合の経路。

方針: **URL を優先**し、無ければ localStorage。**起動時に1回だけ**読み込み、**ユーザーが手動編集したら
自動上書きしない**。煽らない・赤を使わない・モーダルにしない。

---

## 1. `src/lib/importedMortgage.ts`（新規）

```ts
export type MortgageSource =
  | 'currentPlan'
  | 'rateAdjusted'
  | 'fixedPeriodScenario'
  | 'unknown';

export interface ImportedMortgage {
  monthlyPaymentYen?: number;
  annualPaymentYen?: number;
  balanceYen?: number;
  interestRate?: number;   // %表記
  remainingYears?: number;
  bonusAnnualYen?: number;
  source: MortgageSource;
  origin: 'url' | 'localStorage';
}

export const MORTGAGE_STORAGE_KEY = 'lifePlanLab:mortgage';

export const mortgageSourceLabels: Record<Exclude<MortgageSource, 'unknown'>, string> = {
  currentPlan: '現在の返済条件',
  rateAdjusted: '金利変更シナリオ',
  fixedPeriodScenario: '固定期間終了後シナリオ',
};

/** 未知 source でも金額が valid ならデータは捨てない。表示名のフォールバックだけ用意。 */
export function mortgageSourceLabel(source: MortgageSource): string {
  return source === 'unknown'
    ? '住宅ローンシミュレーター'
    : mortgageSourceLabels[source];
}

const isYen = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;
const isRate = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 20;
const isYears = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 50;

function toSource(v: unknown): MortgageSource {
  return v === 'currentPlan' || v === 'rateAdjusted' || v === 'fixedPeriodScenario'
    ? v
    : 'unknown';
}

/** 1項目ずつ防御的に採用。不正項目は無視（全体破棄しない）。 */
function sanitize(
  raw: {
    monthlyPaymentYen?: unknown; annualPaymentYen?: unknown; balanceYen?: unknown;
    interestRate?: unknown; remainingYears?: unknown; bonusAnnualYen?: unknown; source?: unknown;
  },
  origin: 'url' | 'localStorage',
): ImportedMortgage | null {
  const monthlyPaymentYen = isYen(raw.monthlyPaymentYen) ? raw.monthlyPaymentYen : undefined;
  const balanceYen = isYen(raw.balanceYen) ? raw.balanceYen : undefined;
  // 最低限 monthly か balance のどちらかが無ければ取り込み対象外
  if (monthlyPaymentYen == null && balanceYen == null) return null;

  return {
    monthlyPaymentYen,
    annualPaymentYen: isYen(raw.annualPaymentYen) ? raw.annualPaymentYen : undefined,
    balanceYen,
    interestRate: isRate(raw.interestRate) ? raw.interestRate : undefined,
    remainingYears: isYears(raw.remainingYears) ? raw.remainingYears : undefined,
    bonusAnnualYen: isYen(raw.bonusAnnualYen) ? raw.bonusAnnualYen : undefined,
    source: toSource(raw.source),
    origin,
  };
}

function readFromUrl(): ImportedMortgage | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  const num = (k: string) => {
    const v = q.get(k);
    if (v == null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  if (!q.has('mortgageMonthlyPaymentYen') && !q.has('mortgageBalanceYen')) return null;
  return sanitize(
    {
      monthlyPaymentYen: num('mortgageMonthlyPaymentYen'),
      annualPaymentYen: num('mortgageAnnualPaymentYen'),
      balanceYen: num('mortgageBalanceYen'),
      interestRate: num('mortgageInterestRate'),
      remainingYears: num('mortgageRemainingYears'),
      bonusAnnualYen: num('mortgageBonusAnnualYen'),
      source: q.get('mortgageSource') ?? undefined,
    },
    'url',
  );
}

function readFromLocalStorage(): ImportedMortgage | null {
  try {
    const raw = window.localStorage.getItem(MORTGAGE_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return sanitize(
      {
        monthlyPaymentYen: p.selectedMonthlyPaymentYen,
        annualPaymentYen: p.selectedAnnualPaymentYen,
        balanceYen: p.balanceYen,
        interestRate: p.interestRate,
        remainingYears: p.remainingYears,
        bonusAnnualYen: p.bonusAnnualYen,
        source: p.selectedSource,
      },
      'localStorage',
    );
  } catch {
    return null;
  }
}

/** URL → localStorage の順で読む。両方無ければ null。 */
export function readImportedMortgage(): ImportedMortgage | null {
  return readFromUrl() ?? readFromLocalStorage();
}
```

---

## 2. inputStore への追加（既存ストアに合わせて統合）

```ts
// state
importedMortgage: ImportedMortgage | null;
mortgageManuallyEdited: boolean;   // セッション保存があれば一緒に永続化する

// actions
initializeImportedMortgage(): void; // 起動時に1回だけ
markMortgageManuallyEdited(): void; // 住宅ローン項目の手動編集時に呼ぶ
```

```ts
initializeImportedMortgage() {
  const imported = readImportedMortgage();
  if (!imported) return;

  const fromUrl = imported.origin === 'url';
  // URL は明示的な反映指示 → 手動編集履歴をリセットして必ず反映
  // localStorage は手動編集済みなら反映しない（上書き事故防止）
  if (!fromUrl && get().mortgageManuallyEdited) {
    set({ importedMortgage: imported }); // 保持はするが自動反映しない
    return;
  }

  applyMortgageToFields(imported); // ↓ §3
  set({ importedMortgage: imported, mortgageManuallyEdited: fromUrl ? false : get().mortgageManuallyEdited });
  if (fromUrl) set({ mortgageManuallyEdited: false });
}
```

---

## 3. 既存住宅ローン入力欄への反映（フィールド名は要確認）

**総合版の既存フィールド名を必ず確認**してから接続する（例の名前は仮）。新フィールドを安易に増やさない。
**単位変換**: 受信は円。総合版内部が万円なら `yen / 10000`、円ならそのまま。金利は % 表記、年数は年。
既存に `FieldSource` がある場合は `user_input` 扱い（個別シミュレーターでユーザーが決めた値のため）。

```ts
function applyMortgageToFields(m: ImportedMortgage) {
  const toMan = (yen?: number) => (yen != null ? yen / 10000 : undefined); // 内部が万円の場合
  if (m.balanceYen != null)        setField('mortgage.balance', toMan(m.balanceYen), 'user_input');
  if (m.monthlyPaymentYen != null) setField('mortgage.monthlyPayment', toMan(m.monthlyPaymentYen), 'user_input');
  if (m.bonusAnnualYen != null)    setField('mortgage.bonusAnnual', toMan(m.bonusAnnualYen), 'user_input');
  if (m.interestRate != null)      setField('mortgage.interestRate', m.interestRate, 'user_input');
  if (m.remainingYears != null)    setField('mortgage.remainingYears', m.remainingYears, 'user_input');
}
```

---

## 4. App.tsx で起動時1回だけ

```ts
useEffect(() => {
  useInputStore.getState().initializeImportedMortgage();
}, []); // リロードしない限り再読込しない
```

住宅ローン関連の入力欄で `onChange` 時に `markMortgageManuallyEdited()` を呼ぶ（以後 localStorage では上書きしない）。

---

## 5. 控えめバナー（生活費見直しの取り込みバナーとトーンを揃える）

- 表示位置: ①モード選択画面 ②住宅ローン入力ページ上部 ③結果画面の試算条件付近。
- `importedMortgage` があり、かつ `mortgageManuallyEdited === false` のときだけ表示。**手動編集したら非表示**。
- 赤/警告色なし・モーダルなし。文言例:
  - モード選択: 「住宅ローンシミュレーターの結果を読み込みました／反映予定の毎月返済額：9.5万円/月」
  - 入力ページ: 「住宅ローンシミュレーターから、毎月返済額9.5万円/月・残高3,200万円を読み込み済みです。この画面で手動変更できます。」
  - 結果画面: 「反映された住宅ローン：毎月9.5万円/月／残高：3,200万円／反映元：現在の返済条件」
- 反映元表示は `mortgageSourceLabel(importedMortgage.source)`（未知は「住宅ローンシミュレーター」）。

---

## 6. テスト（総合版側）

- URL パラメータが localStorage より優先される / URL 無効値なら localStorage にフォールバック。
- localStorage の `lifePlanLab:mortgage` を読み込める。
- source 未知値でも金額が valid なら取り込める。
- currentPlan / rateAdjusted / fixedPeriodScenario のラベルが表示される。
- 毎月返済額・残高が円から総合版内部単位へ正しく変換される / 金利・残年数が反映される。
- 住宅ローン項目を手動編集すると `mortgageManuallyEdited = true`。
- 手動編集後、URL 無しでは localStorage 値で上書きされない。
- URL パラメータ付き起動時は手動編集履歴をリセットして URL 値を適用。
- 起動時1回だけ読み込む。
- バナーがモード選択・住宅ローン入力・結果に控えめに表示／手動編集後に消える。

---

## 7. やらないこと
リアルタイム同期 / postMessage 連携 / 月次返済表の展開 / 計算ロジック移植 / 借換・繰上の推奨 /
固定期間終了後の詳細再現。総合版へ渡すのは「生活設計で使う住宅ローン条件」のみ。
