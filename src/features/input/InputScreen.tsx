// 入力画面（1枚スクロール）。前提（残高・金利・残り年数・返済方式）を先に集め、
// 毎月返済額を自動計算 → 手動修正可とする。
// 未入力・0以下はやさしく扱い、赤エラーは使わない（DESIGN_HANDOFF.md 2章）。

import { useMortgageStore } from '../../store/useMortgageStore';
import { strings } from '../../strings/ja';
import { fixedPeriodExceedsTerm } from '../../lib/mortgage';
import { yenPerMonth } from '../../lib/format';
import type { RateType, RepayMethod } from '../../types/mortgage';
import { QuestionCard } from './QuestionCard';
import { NumberField } from './NumberField';
import { ChoiceField } from './ChoiceField';

const f = strings.input.fields;

const rateTypeOptions: { value: RateType; label: string }[] = [
  { value: 'variable', label: strings.rateTypeLabels.variable },
  { value: 'fixed', label: strings.rateTypeLabels.fixed },
  { value: 'fixed-period', label: strings.rateTypeLabels['fixed-period'] },
];

const repayMethodOptions: { value: RepayMethod; label: string }[] = [
  { value: 'equal-payment', label: strings.repayMethodLabels['equal-payment'] },
  { value: 'equal-principal', label: strings.repayMethodLabels['equal-principal'] },
];

export function InputScreen() {
  const { input, setField, setMonthlyPayment, useAutoMonthly, goTo } = useMortgageStore();
  const m = f.monthlyPayment;

  // 赤エラーは出さず、muted トーンの「気づき」を必要な場合だけ添える
  const ageSoftError =
    input.currentAge != null && (input.currentAge < 0 || input.currentAge > 120)
      ? strings.input.softErrors.ageOutOfRange
      : undefined;
  const rateSoftError =
    input.rate != null && input.rate > 15
      ? strings.input.softErrors.rateHigh
      : undefined;
  const fixedExceeds = fixedPeriodExceedsTerm(input);
  const isFixedPeriod = input.rateType === 'fixed-period';
  const isManual = input.monthlyPaymentSource === 'manual';

  return (
    <div className="app">
      <div className="step-layout">
        <div className="step-content">
          <header className="step-head">
            <h1 className="hero__title">{strings.input.heading}</h1>
            <p className="muted">{strings.input.lead}</p>
          </header>

          {/* ① 現在年齢 */}
          <QuestionCard label={f.currentAge.label} help={f.currentAge.help} hint={ageSoftError}>
            <NumberField
              value={input.currentAge}
              onChange={(v) => setField('currentAge', v)}
              unit={f.currentAge.unit}
              placeholder={f.currentAge.placeholder}
              allowDecimal={false}
              ariaLabel={f.currentAge.label}
            />
          </QuestionCard>

          {/* ② 住宅ローン残高 */}
          <QuestionCard label={f.balance.label} help={f.balance.help}>
            <NumberField
              value={input.balance}
              onChange={(v) => setField('balance', v)}
              unit={f.balance.unit}
              placeholder={f.balance.placeholder}
              allowDecimal={false}
              ariaLabel={f.balance.label}
            />
          </QuestionCard>

          {/* ③ 現在の金利 */}
          <QuestionCard label={f.rate.label} help={f.rate.help} hint={rateSoftError}>
            <NumberField
              value={input.rate}
              onChange={(v) => setField('rate', v)}
              unit={f.rate.unit}
              placeholder={f.rate.placeholder}
              ariaLabel={f.rate.label}
            />
          </QuestionCard>

          {/* ④ 金利タイプ（+ 固定期間選択型のみ追加フォーム） */}
          <QuestionCard label={f.rateType.label} help={f.rateType.help}>
            <ChoiceField
              options={rateTypeOptions}
              value={input.rateType}
              onChange={(v) => setField('rateType', v)}
            />
          </QuestionCard>

          {isFixedPeriod && (
            <>
              <QuestionCard
                label={f.fixedPeriodRemainingYears.label}
                help={f.fixedPeriodRemainingYears.help}
                hint={fixedExceeds ? strings.input.softErrors.fixedPeriodExceeds : undefined}
              >
                <NumberField
                  value={input.fixedPeriodRemainingYears}
                  onChange={(v) => setField('fixedPeriodRemainingYears', v)}
                  unit={f.fixedPeriodRemainingYears.unit}
                  placeholder={f.fixedPeriodRemainingYears.placeholder}
                  allowDecimal={false}
                  ariaLabel={f.fixedPeriodRemainingYears.label}
                />
              </QuestionCard>

              <QuestionCard label={f.postFixedRate.label} help={f.postFixedRate.help}>
                <NumberField
                  value={input.postFixedRate}
                  onChange={(v) => setField('postFixedRate', v)}
                  unit={f.postFixedRate.unit}
                  placeholder={f.postFixedRate.placeholder}
                  ariaLabel={f.postFixedRate.label}
                />
              </QuestionCard>
            </>
          )}

          {/* ⑤ 残り返済年数 */}
          <QuestionCard label={f.remainingYears.label} help={f.remainingYears.help}>
            <NumberField
              value={input.remainingYears}
              onChange={(v) => setField('remainingYears', v)}
              unit={f.remainingYears.unit}
              placeholder={f.remainingYears.placeholder}
              allowDecimal={false}
              ariaLabel={f.remainingYears.label}
            />
          </QuestionCard>

          {/* ⑥ 返済方式 */}
          <QuestionCard label={f.repayMethod.label} help={f.repayMethod.help}>
            <ChoiceField
              options={repayMethodOptions}
              value={input.repayMethod}
              onChange={(v) => setField('repayMethod', v)}
            />
          </QuestionCard>

          {/* ⑦ ボーナス返済 年額 */}
          <QuestionCard label={f.bonusAnnual.label} help={f.bonusAnnual.help}>
            <NumberField
              value={input.bonusAnnual}
              onChange={(v) => setField('bonusAnnual', v)}
              unit={f.bonusAnnual.unit}
              placeholder={f.bonusAnnual.placeholder}
              allowDecimal={false}
              ariaLabel={f.bonusAnnual.label}
            />
          </QuestionCard>

          {/* ⑧ 毎月返済額（自動計算 + 手動修正可） */}
          <QuestionCard label={m.label} help={m.help}>
            <NumberField
              value={input.monthlyPayment}
              onChange={(v) => setMonthlyPayment(v)}
              unit={m.unit}
              placeholder={m.placeholder}
              allowDecimal={false}
              ariaLabel={m.label}
            />
            <div className="monthly-meta">
              <span className={`tag ${isManual ? 'tag--manual' : 'tag--auto'}`}>
                {isManual ? m.manualBadge : m.autoBadge}
              </span>
              {isManual && input.calculatedMonthlyPayment != null && (
                <button type="button" className="link-btn" onClick={useAutoMonthly}>
                  {m.resetToAuto}（{yenPerMonth(input.calculatedMonthlyPayment)}）
                </button>
              )}
            </div>
            <p className="qcard__hint muted">{m.autoNote}</p>
          </QuestionCard>
        </div>

        <nav className="bottom-nav">
          <div className="bottom-nav__row">
            <button type="button" className="btn btn--skip" onClick={() => goTo('intro')}>
              戻る
            </button>
            <button
              type="button"
              className="btn btn--primary bottom-nav__primary"
              onClick={() => goTo('result')}
            >
              {strings.input.toResult}
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
