// 入力画面（1枚スクロール）。8項目を QuestionCard で縦並びにし、
// 下部固定の「結果を見る」CTA で結果へ進む。
// 未入力・0以下はやさしく扱い、赤エラーは使わない（DESIGN_HANDOFF.md 2章）。

import { useMortgageStore } from '../../store/useMortgageStore';
import { strings } from '../../strings/ja';
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
  const { input, setField, goTo } = useMortgageStore();

  // 赤エラーは出さず、muted トーンの「気づき」を必要な場合だけ添える
  const ageSoftError =
    input.currentAge != null && (input.currentAge < 0 || input.currentAge > 120)
      ? strings.input.softErrors.ageOutOfRange
      : undefined;
  const rateSoftError =
    input.rate != null && input.rate > 15
      ? strings.input.softErrors.rateHigh
      : undefined;

  return (
    <div className="app">
      <div className="step-layout">
        <div className="step-content">
          <header className="step-head">
            <h1 className="hero__title">{strings.input.heading}</h1>
            <p className="muted">{strings.input.lead}</p>
          </header>

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

          <QuestionCard label={f.rate.label} help={f.rate.help} hint={rateSoftError}>
            <NumberField
              value={input.rate}
              onChange={(v) => setField('rate', v)}
              unit={f.rate.unit}
              placeholder={f.rate.placeholder}
              ariaLabel={f.rate.label}
            />
          </QuestionCard>

          <QuestionCard label={f.rateType.label} help={f.rateType.help}>
            <ChoiceField
              options={rateTypeOptions}
              value={input.rateType}
              onChange={(v) => setField('rateType', v)}
            />
          </QuestionCard>

          <QuestionCard label={f.monthlyPayment.label} help={f.monthlyPayment.help}>
            <NumberField
              value={input.monthlyPayment}
              onChange={(v) => setField('monthlyPayment', v)}
              unit={f.monthlyPayment.unit}
              placeholder={f.monthlyPayment.placeholder}
              allowDecimal={false}
              ariaLabel={f.monthlyPayment.label}
            />
          </QuestionCard>

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

          <QuestionCard label={f.repayMethod.label} help={f.repayMethod.help}>
            <ChoiceField
              options={repayMethodOptions}
              value={input.repayMethod}
              onChange={(v) => setField('repayMethod', v)}
            />
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
