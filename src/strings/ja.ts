// UI 文言の一元管理。煽らない・止めない・整理する（DESIGN_HANDOFF.md 2章）。
// 「破綻」「危険」など不安を煽る語、借換/繰上/金利選択を推奨する語は使わない。

import type { RateType, RepayMethod } from '../types/mortgage';

/** 総合版（人生全体の資産推移）への遷移先。MVP では仮 URL。 */
export const LIFE_PLAN_LAB_URL = 'https://life-plan-lab.example.com/';

export const strings = {
  app: {
    title: '住宅ローン シミュレーター',
    subtitle: 'LIFE PLAN LAB',
  },

  intro: {
    heading: '住宅ローンの負担を、生活設計の中で確認する',
    lead: 'これは未来を当てるためではなく、住まいの費用を整理するための簡易試算です。分かる範囲で大丈夫です。あとから条件を変えて、何度でも計算し直せます。',
    canDo: [
      '毎月の返済額やボーナス返済から、年間の負担と完済予定の年齢を見える化します。',
      '残高・金利・残り年数から、残りの返済総額の目安を確認できます。',
      '金利が上がったとき、返済の負担がどのくらい変わるかを参考として確認できます。',
    ],
    note: '総合版のライフプランシミュレーターでは住宅費をまとめて扱いますが、ここではもう少し細かく、住宅ローンだけを取り出して確認します。',
    start: 'はじめる',
  },

  input: {
    heading: '住宅ローンの条件を入力',
    lead: '分かる範囲で入力してください。未入力や「0」のままでも計算は進みます。あとから変更できます。',
    fields: {
      currentAge: {
        label: '現在の年齢',
        unit: '歳',
        help: '今のあなたの年齢です。完済予定の年齢を出すために使います。',
        placeholder: '例: 40',
      },
      balance: {
        label: '住宅ローン残高',
        unit: '円',
        help: '今残っているローンの金額です。返済予定表や金融機関アプリの「残高」を見ると分かります。',
        placeholder: '例: 30000000',
      },
      rate: {
        label: '現在の金利（年率）',
        unit: '%',
        help: '今の借入金利です。返済予定表や契約書、金融機関アプリで確認できます。例: 0.925',
        placeholder: '例: 0.925',
      },
      rateType: {
        label: '金利タイプ',
        help: 'いまの金利の種類です。MVPでは表示・説明のために使います（計算は共通の概算です）。',
      },
      monthlyPayment: {
        label: '毎月の返済額',
        unit: '円',
        help: '毎月口座から引き落とされる返済額です。ボーナス返済は別に入力します。',
        placeholder: '例: 85000',
      },
      bonusAnnual: {
        label: 'ボーナス返済（年額）',
        unit: '円',
        help: 'ボーナス月にまとめて返済する分の年間合計です。なければ 0 のままで大丈夫です。',
        placeholder: '例: 200000',
      },
      remainingYears: {
        label: '残りの返済年数',
        unit: '年',
        help: 'あと何年で完済予定かです。返済予定表の最終回や、契約年数から経過年数を引いて分かります。',
        placeholder: '例: 25',
      },
      repayMethod: {
        label: '返済方式',
        help: '元利均等は毎月の返済額が一定、元金均等は元金部分が一定です。MVPでは参考情報として保持します。',
      },
    },
    softErrors: {
      // 赤エラーは使わず、muted トーンでやさしく案内する
      ageOutOfRange: '年齢は 0〜120 くらいの範囲で入力すると、完済予定が自然に出ます。',
      rateHigh: '金利がかなり大きいようです。年率（%）で入力されているかご確認ください。',
      empty: '未入力のままでも概算できます。あとから変更できます。',
    },
    toResult: '結果を見る',
  },

  result: {
    heading: '住宅ローンの試算結果',
    framing:
      'これは一般的な前提に基づく概算です。未来を当てるためではなく、整理するためのものです。',
    metrics: {
      annualPayment: {
        label: '年間返済額',
        caption: '毎月返済額 × 12 + ボーナス返済 年額',
      },
      payoffAge: {
        label: '完済予定の年齢',
        caption: '現在の年齢 + 残りの返済年数',
        unit: '歳',
      },
      remainingTotal: {
        label: '残り返済総額の概算',
        caption: '年間返済額 × 残りの返済年数（簡易試算）',
      },
      referenceMonthly: {
        label: '参考: 元利均等の概算 月返済額',
        caption: '残高・金利・残り年数から計算した目安です。実際の返済額とは異なります。',
      },
    },

    rateAdjust: {
      heading: '金利を少し動かして見る',
      lead: '金利を動かすと、返済の負担がどのくらい変わるかを参考として確認できます。これは試算用の一時的な変更で、入力した条件そのものは変わりません。',
      currentLabel: '試算する金利',
      stepLabel: '刻み幅',
      decrease: '−',
      increase: '＋',
      reset: '現在の金利に戻す',
      referenceMonthly: '参考 月返済額',
      monthlyIncrease: '毎月の負担増（概算ベース）',
      annualIncrease: '年間負担増の目安',
      remainingTotalIncrease: '残り返済総額への影響の目安',
      vsUserMonthly: '入力した毎月返済額との差',
    },

    presetHeading: '金利が上がった場合の参考影響',
    presetLead: '現在の金利から、それぞれ上がった場合の参考月返済額と負担増の目安です。',
    presetColumns: {
      delta: '金利',
      monthly: '参考 月返済額',
      vsUser: '現在返済額との差',
      annual: '年間負担増',
      total: '残り総額への影響',
    },

    conditionHeading: '入力した条件の確認',
    conditionLead: 'この試算に使った条件です。変えたいときは「条件を変えて再計算」から。',

    notesHeading: 'この試算についての注記',
    notes: [
      'このシミュレーションは、生活設計のための簡易試算です。',
      '実際の返済額は、借入条件、返済方式、金融機関のルール、金利見直し時期などにより異なります。',
      '変動金利の場合、金利が変わってもすぐに返済額が変わらない契約もあります。詳細は金融機関の契約内容をご確認ください。',
      '金利を動かしたときの参考額は、元利均等返済をもとにした概算です。元金均等を選んだ場合も、この概算で表示しています。',
      'この結果は、借り換え・繰上返済・金利選択を推奨するものではありません。',
    ],

    actions: {
      recalc: '条件を変えて再計算',
      saveToLifePlan: 'この条件を生活設計に反映する',
      viewLifePlan: '人生全体の資産推移で見る',
    },
    saved: '生活設計に反映する条件を保存しました。総合版で読み込めるように保存しています。',
    saveFailed: '保存できませんでした。ブラウザの設定（プライベートモードなど）をご確認ください。',
  },

  rateTypeLabels: {
    variable: '変動',
    fixed: '固定',
    'fixed-period': '固定期間選択',
  } as Record<RateType, string>,

  repayMethodLabels: {
    'equal-payment': '元利均等',
    'equal-principal': '元金均等',
  } as Record<RepayMethod, string>,
};

/** 金利ステッパーの刻み幅候補（%ポイント）。0.05 を含むことで 0.25 にも到達できる。 */
export const RATE_STEPS = [0.05, 0.1, 0.5] as const;

/** プリセットの金利上昇シナリオ（%ポイント）。 */
export const RATE_PRESETS = [0.5, 1.0, 2.0] as const;
