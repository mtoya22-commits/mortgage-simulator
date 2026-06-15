// 「金利を少し動かして見る」カード。試算用の一時金利を ［−］［＋］ で動かし、
// 月返済額・毎月/年間の負担増・残り返済総額への影響をその場で再計算する。
// 刻み幅は 0.005 / 0.01 / 0.05 / 0.1%（既定 0.1）。
// 月返済額の絶対値は、入力した毎月返済額がある場合はそれを起点に増加分を足して表示する。

import { useMemo, useState } from 'react';
import { rateScenarioAt, safeNumber } from '../../lib/mortgage';
import { yenPerMonth, yen, man, signedYen, signedMan, percent } from '../../lib/format';
import { strings, RATE_STEPS } from '../../strings/ja';
import type { MortgageInput } from '../../types/mortgage';

interface RateAdjustCardProps {
  input: MortgageInput;
}

const RATE_MAX = 20; // 試算上の上限（%）。極端な値での暴走を防ぐ。

export function RateAdjustCard({ input }: RateAdjustCardProps) {
  const baseRate = safeNumber(input.rate);
  const [step, setStep] = useState<number>(0.1);
  const [rate, setRate] = useState<number>(baseRate);

  const round = (v: number) => Math.round(v * 1000) / 1000; // 浮動小数の誤差を抑える
  const dec = () => setRate((r) => round(Math.max(0, r - step)));
  const inc = () => setRate((r) => round(Math.min(RATE_MAX, r + step)));
  const reset = () => setRate(baseRate);

  const scenario = useMemo(
    () => rateScenarioAt(input.balance, baseRate, input.remainingYears, rate, input.repayMethod),
    [input.balance, baseRate, input.remainingYears, rate, input.repayMethod],
  );

  const t = strings.result.rateAdjust;

  // 月返済額の絶対値: 入力した毎月返済額がある場合はそれを起点に、計算した増加分を足す。
  // 入力が無い場合は計算した参考月返済額を表示する。増加幅自体は計算ベースのまま。
  const userMonthly = safeNumber(input.monthlyPayment);
  const displayMonthly =
    userMonthly > 0 ? userMonthly + scenario.monthlyIncrease : scenario.referenceMonthly;
  const monthlyLabel = userMonthly > 0 ? t.monthlyAnchored : t.referenceMonthly;

  const changed = round(rate) !== round(baseRate);

  return (
    <section className="collapsible collapsible--card adjust">
      <div className="adjust__head">
        <h2 className="section-heading" style={{ margin: 0 }}>
          {t.heading}
        </h2>
      </div>
      <p className="muted adjust__lead">{t.lead}</p>

      <div className="adjust__stepper">
        <span className="adjust__rate-label muted">{t.currentLabel}</span>
        <div className="adjust__rate-row">
          <button
            type="button"
            className="btn adjust__step-btn"
            aria-label="金利を下げる"
            onClick={dec}
            disabled={rate <= 0}
          >
            {t.decrease}
          </button>
          <span className="adjust__rate-value" aria-live="polite">
            {percent(rate)}
          </span>
          <button
            type="button"
            className="btn adjust__step-btn"
            aria-label="金利を上げる"
            onClick={inc}
            disabled={rate >= RATE_MAX}
          >
            {t.increase}
          </button>
        </div>
      </div>

      <div className="adjust__steps">
        <span className="muted adjust__steps-label">{t.stepLabel}</span>
        <div className="choice-group">
          {RATE_STEPS.map((s) => (
            <button
              key={s}
              type="button"
              className={`choice adjust__step-choice${step === s ? ' choice--selected' : ''}`}
              onClick={() => setStep(s)}
            >
              {percent(s, 3)}
            </button>
          ))}
        </div>
      </div>

      <dl className="adjust__results">
        <div className="adjust__item">
          <dt>{monthlyLabel}</dt>
          <dd>{yenPerMonth(displayMonthly)}</dd>
        </div>
        <div className="adjust__item">
          <dt>{t.monthlyIncrease}</dt>
          <dd className={scenario.monthlyIncrease > 0 ? 'is-up' : ''}>
            {signedYen(scenario.monthlyIncrease)}
            <span className="muted"> / 月</span>
          </dd>
        </div>
        <div className="adjust__item">
          <dt>{t.annualIncrease}</dt>
          <dd className={scenario.annualIncrease > 0 ? 'is-up' : ''}>
            {signedYen(scenario.annualIncrease)}
            <span className="muted"> / 年</span>
          </dd>
        </div>
        <div className="adjust__item">
          <dt>{t.remainingTotalIncrease}</dt>
          <dd className={scenario.remainingTotalIncrease > 0 ? 'is-up' : ''}>
            {signedMan(scenario.remainingTotalIncrease)}
          </dd>
        </div>
      </dl>

      {changed && (
        <button type="button" className="btn btn--skip adjust__reset" onClick={reset}>
          {t.reset}
        </button>
      )}

      <p className="muted adjust__hint">
        {/* 大きな桁は円と万円を併記して読みやすくする */}
        月返済額（目安）{yen(displayMonthly)} ／ 残り総額への影響 約{' '}
        {man(scenario.remainingTotalIncrease)}
      </p>
      <p className="muted adjust__note">{t.note}</p>
    </section>
  );
}
