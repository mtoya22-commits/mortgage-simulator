// 結果画面。Hero（主指標）→ 金利ステッパー → プリセット参考影響 →
// 入力条件の確認 → 注記 → 次アクション。モーダルは使わず <details> で展開する。

import { useMemo, useState } from 'react';
import { useMortgageStore } from '../../store/useMortgageStore';
import { strings, RATE_PRESETS, LIFE_PLAN_LAB_URL } from '../../strings/ja';
import { computeResult, rateScenario, safeNumber } from '../../lib/mortgage';
import { saveMortgage } from '../../lib/storage';
import { yen, man, yenPerMonth, signedYen, signedMan, percent } from '../../lib/format';
import { RateAdjustCard } from './RateAdjustCard';

export function ResultScreen() {
  const { input, goTo } = useMortgageStore();
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'failed'>('idle');

  const result = useMemo(() => computeResult(input), [input]);
  const baseRate = safeNumber(input.rate);
  const userMonthly = safeNumber(input.monthlyPayment);

  const presets = useMemo(
    () =>
      RATE_PRESETS.map((delta) =>
        rateScenario(input.balance, baseRate, input.remainingYears, delta),
      ),
    [input.balance, baseRate, input.remainingYears],
  );

  const t = strings.result;

  const handleSave = () => {
    setSaveState(saveMortgage(input) ? 'saved' : 'failed');
  };

  return (
    <div className="app">
      <div className="screen screen--result fade-rise">
        <header className="hero">
          <p className="hero__eyebrow">{strings.app.title}</p>
          <h1 className="hero__title">{t.heading}</h1>
          <p className="hero__lead muted">{t.framing}</p>
        </header>

        {/* 主指標 */}
        <section className="metrics">
          <div className="metric metric--primary">
            <span className="metric__label">{t.metrics.annualPayment.label}</span>
            <span className="metric__value">{yen(result.annualPayment)}</span>
            <span className="metric__caption muted">{t.metrics.annualPayment.caption}</span>
          </div>
          <div className="metric">
            <span className="metric__label">{t.metrics.payoffAge.label}</span>
            <span className="metric__value">
              {result.payoffAge} {t.metrics.payoffAge.unit}
            </span>
            <span className="metric__caption muted">{t.metrics.payoffAge.caption}</span>
          </div>
          <div className="metric">
            <span className="metric__label">{t.metrics.remainingTotal.label}</span>
            <span className="metric__value">{man(result.remainingTotal)}</span>
            <span className="metric__caption muted">{t.metrics.remainingTotal.caption}</span>
          </div>
          <div className="metric metric--ref">
            <span className="metric__label">{t.metrics.referenceMonthly.label}</span>
            <span className="metric__value">{yenPerMonth(result.referenceMonthly)}</span>
            <span className="metric__caption muted">{t.metrics.referenceMonthly.caption}</span>
          </div>
        </section>

        {/* What-if を上に: 金利ステッパー */}
        <RateAdjustCard input={input} />

        {/* プリセットの金利上昇影響 */}
        <section className="collapsible collapsible--muted" style={{ padding: '14px 18px' }}>
          <h2 className="section-heading" style={{ marginTop: 0 }}>
            {t.presetHeading}
          </h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {t.presetLead}
          </p>
          <div className="preset-table" role="table">
            <div className="preset-row preset-row--head" role="row">
              <span role="columnheader">{t.presetColumns.delta}</span>
              <span role="columnheader">{t.presetColumns.monthly}</span>
              <span role="columnheader">{t.presetColumns.annual}</span>
              <span role="columnheader">{t.presetColumns.total}</span>
            </div>
            <div className="preset-row" role="row">
              <span className="muted" role="cell">
                現在 {percent(baseRate)}
              </span>
              <span role="cell">{yenPerMonth(result.referenceMonthly)}</span>
              <span className="muted" role="cell">
                —
              </span>
              <span className="muted" role="cell">
                —
              </span>
            </div>
            {presets.map((p) => (
              <div className="preset-row" key={p.deltaPct} role="row">
                <span role="cell">
                  +{percent(p.deltaPct, 1)}
                  <span className="muted preset-newrate"> （{percent(p.newRate)}）</span>
                </span>
                <span role="cell">{yenPerMonth(p.referenceMonthly)}</span>
                <span className="is-up" role="cell">
                  {signedYen(p.annualIncrease)}
                </span>
                <span className="is-up" role="cell">
                  {signedMan(p.remainingTotalIncrease)}
                </span>
              </div>
            ))}
          </div>
          {userMonthly > 0 && (
            <p className="muted preset-note">
              ※ 参考月返済額は元利均等の概算です。入力した毎月返済額（{yenPerMonth(userMonthly)}）とは
              前提により差が出ることがあります。
            </p>
          )}
        </section>

        {/* 入力条件の確認 */}
        <details className="collapsible collapsible--muted">
          <summary>{t.conditionHeading}</summary>
          <div className="collapsible__body">
            <p className="muted" style={{ marginTop: 0 }}>
              {t.conditionLead}
            </p>
            <dl className="condition-list">
              <Row label={strings.input.fields.currentAge.label} value={`${safeNumber(input.currentAge)} 歳`} />
              <Row label={strings.input.fields.balance.label} value={`${yen(safeNumber(input.balance))}（約 ${man(safeNumber(input.balance))}）`} />
              <Row label={strings.input.fields.rate.label} value={percent(baseRate)} />
              <Row label={strings.input.fields.rateType.label} value={strings.rateTypeLabels[input.rateType]} />
              <Row label={strings.input.fields.monthlyPayment.label} value={yenPerMonth(safeNumber(input.monthlyPayment))} />
              <Row label={strings.input.fields.bonusAnnual.label} value={yen(safeNumber(input.bonusAnnual))} />
              <Row label={strings.input.fields.remainingYears.label} value={`${safeNumber(input.remainingYears)} 年`} />
              <Row label={strings.input.fields.repayMethod.label} value={strings.repayMethodLabels[input.repayMethod]} />
            </dl>
          </div>
        </details>

        {/* 注記 */}
        <details className="collapsible collapsible--muted">
          <summary>{t.notesHeading}</summary>
          <div className="collapsible__body">
            <ul className="notes-list muted">
              {t.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        </details>

        {/* 次アクション */}
        <section className="result-actions">
          <button type="button" className="btn" onClick={() => goTo('input')}>
            {t.actions.recalc}
          </button>
          <button type="button" className="btn btn--primary" onClick={handleSave}>
            {t.actions.saveToLifePlan}
          </button>
          <a
            className="btn btn--recommended result-actions__link"
            href={LIFE_PLAN_LAB_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.actions.viewLifePlan}
          </a>
          {saveState === 'saved' && <p className="muted save-msg">{t.saved}</p>}
          {saveState === 'failed' && <p className="muted save-msg">{t.saveFailed}</p>}
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="condition-row">
      <dt className="muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
