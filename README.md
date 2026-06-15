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

結果画面の「この条件を生活設計に反映する」で、`localStorage` キー `lifePlanLab:mortgage` に
以下の形式で保存します（総合版が読み込める前提のスキーマ）。

```json
{
  "version": 1,
  "source": "mortgage-simulator",
  "savedAt": "<ISO文字列>",
  "mortgage": {
    "balance": 0, "monthlyPayment": 0, "bonusAnnual": 0,
    "remainingYears": 0, "rate": 0,
    "rateType": "variable", "repayMethod": "equal-payment"
  }
}
```

## GitHub Pages 公開

`.github/workflows/deploy-pages.yml` が `main` への push（または Actions の手動実行）で
ビルドして Pages へデプロイします。初回のみ **Settings → Pages → Source を「GitHub Actions」**
に設定してください。フィーチャーブランチの push ではデプロイしません（事故防止）。
Vite は `base: './'`（相対パス）で出力するため、プロジェクトサイトのサブパスでも崩れません。
