# 住宅ローン シミュレーター（LIFE PLAN LAB）

総合版ライフプランシミュレーター（life-plan-lab）と見た目・文言トーン・操作感を揃えた、
住宅ローン専用の小型シミュレーター MVP です。住宅ローン負担を **残高・金利・毎月返済額・
ボーナス返済・残り年数・金利上昇時の影響** に分解して、生活設計の中で確認できます。

> このシミュレーションは、生活設計のための簡易試算です。実際の返済額は、借入条件・返済方式・
> 金融機関のルール・金利見直し時期などにより異なります。借り換え・繰上返済・金利選択を推奨するものではありません。

## 開発

```bash
npm install      # 依存をインストール
npm run dev      # ローカル開発サーバ（http://localhost:5173）
npm run build    # 本番ビルド（tsc 型チェック + vite build → dist/）
npm run preview  # ビルド結果のプレビュー
npm test         # 計算ロジックのテスト（vitest）
```

## 構成

- React + Vite + TypeScript（`strict`）
- 計算ロジックは `src/lib/mortgage.ts` に純粋関数として分離
- 型は `src/types/`、UI 文言は `src/strings/ja.ts`、状態は `src/store/`（zustand）
- デザイントークンは `src/styles/shared-tokens.css`（`docs/shared-tokens.css` のコピー）

画面: 導入（intro）→ 入力（input・1枚スクロール）→ 結果（result）。
結果画面の「金利を少し動かして見る」で、試算用の一時金利を ［−］［＋］で動かして
負担増減の目安をその場で確認できます。

## 総合版への連携

結果画面の「生活設計に反映する」で、反映対象（現在の返済条件／金利変更シナリオ／固定期間終了後シナリオ）
を選んで `localStorage` キー `lifePlanLab:mortgage` に**確定データ**を保存します。金額は円、金利は % 表記、
年数は年で統一しています（総合版が読み込む前提のスキーマ）。

```json
{
  "selectedMonthlyPaymentYen": 95000,
  "selectedAnnualPaymentYen": 1140000,
  "selectedSource": "currentPlan",
  "balanceYen": 32000000,
  "interestRate": 0.925,
  "remainingYears": 30,
  "repaymentMethod": "equalPrincipal",
  "monthlyPaymentYen": 95000,
  "bonusAnnualYen": 0,
  "rateType": "variable",
  "scenarioMonthlyPaymentYen": 108000,
  "scenarioInterestRate": 1.425,
  "scenarioLabel": "金利変更シナリオ",
  "savedAt": "<ISO文字列>",
  "version": 1
}
```

- **確定キー**: `lifePlanLab:mortgage`（総合版へ渡す確定データ）。
- **下書きキー**: `lifePlanLab:mortgageDraft`（入力途中の自動保存。確定とは別物）。
- 別 origin で localStorage を共有できない場合に備え、「人生全体の資産推移で見る」リンクには
  `mortgageMonthlyPaymentYen` などの **`mortgage` プレフィックス付き URL パラメータ**も付与します
  （単位は 円 / % / 年）。
- 総合版側の受け取り実装（URL 優先・localStorage 補助・手動編集優先・バナー）は
  [`docs/INTEGRATION.md`](./docs/INTEGRATION.md) のリファレンスを参照してください。
- 「人生全体の資産推移で見る」の遷移先（総合版 URL）は本番デフォルト
  `https://fire-lifeplan-lab.com/life-plan-simulator/`。環境変数 `VITE_LIFE_PLAN_LAB_URL`
  を設定するとビルド時に上書きできます（未設定でも本番 URL を使用。example.com には遷移しません）。

## WordPress への iframe 埋め込み（自動高さ）

二重スクロールを避けるため、アプリはコンテンツ高さを親ページへ `postMessage`
（`type: "lifeplanlab:resize"`）で送ります。親側は `scrolling="no"` の iframe を置き、
受信した高さで `iframe.style.height` を更新します。貼り付けコードと仕組みは
[`docs/EMBED.md`](./docs/EMBED.md) を参照してください。

## GitHub Pages 公開

`.github/workflows/deploy-pages.yml` が `main` への push（または Actions の手動実行）で
ビルドして Pages へデプロイします。初回のみ **Settings → Pages → Source を「GitHub Actions」**
に設定してください。フィーチャーブランチの push ではデプロイしません（事故防止）。
Vite は `base: './'`（相対パス）で出力するため、プロジェクトサイトのサブパスでも崩れません。
