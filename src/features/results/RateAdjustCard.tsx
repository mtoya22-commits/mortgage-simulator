// 「金利を少し動かして見る」カード。試算用の一時金利を ［−］［＋］ で動かし、
// 参考月返済額・毎月/年間の負担増・残り返済総額への影響をその場で再計算する。
// 刻み幅は 0.05 / 0.1 / 0.5%（既定 0.1）。0.05 を含むので 0.25% にも到達できる。

import { useMemo, useState } from 'react';
import { rateScenarioAt, equalInstallmentMonthly, safeNumber } from '../../lib/mortgage';
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
    () => rateScenarioAt(input.balance, baseRate, input.remainingYears, rate),
    [input.balance, baseRate, input.remainingYears, rate],
  );

  // 入力した毎月返済額との差（参考）。ユーザーの実額と概算のギャップを示す。
  const userMonthly = safeNumber(input.monthlyPayment);
  const vsUserMonthly = useMemo(() => {
    const refAtRate = equalInstallmentMonthly(input.balance, rate, input.remainingYears);
    return userMonthly > 0 ? refAtRate - userMonthly : null;
  }, [input.balance, rate, input.remainingYears, userMonthly]);

  const t = strings.result.rateAdjust;
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
              {percent(s, 2)}
            </button>
          ))}
        </div>
      </div>

      <dl className="adjust__results">
        <div className="adjust__item">
          <dt>{t.referenceMonthly}</dt>
          <dd>{yenPerMonth(scenario.referenceMonthly)}</dd>
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
        {vsUserMonthly != null && (
          <div className="adjust__item">
            <dt>{t.vsUserMonthly}</dt>
            <dd>{signedYen(vsUserMonthly)}</dd>
          </div>
        )}
      </dl>

      {changed && (
        <button type="button" className="btn btn--skip adjust__reset" onClick={reset}>
          {t.reset}
        </button>
      )}

      <p className="muted adjust__hint">
        {/* 大きな桁は円と万円を併記して読みやすくする */}
        参考月返済額 {yen(scenario.referenceMonthly)} ／ 残り総額への影響 約{' '}
        {man(scenario.remainingTotalIncrease)}
      </p>
    </section>
  );
}
