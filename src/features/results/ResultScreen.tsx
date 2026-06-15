// 結果画面。Hero（主指標）→ 毎月返済額の確認 → 金利ステッパー → 金利上昇テーブル →
// 残高推移グラフ → 固定期間終了後シミュレーション → 入力条件 → 注記 → 次アクション。
// 長くなりすぎないよう詳細は collapsible / <details> で折りたたむ（モーダル不使用）。

import { useMemo, useState } from 'react';
import { useMortgageStore } from '../../store/useMortgageStore';
import { strings, RATE_PRESETS, LIFE_PLAN_LAB_URL } from '../../strings/ja';
import {
  computeResult,
  rateScenario,
  buildAmortizationSchedule,
  fixedPeriodImpact,
  monthlyPaymentDivergence,
  safeNumber,
} from '../../lib/mortgage';
import { saveMortgage } from '../../lib/storage';
import { yen, man, yenPerMonth, signedYen, signedMan, percent } from '../../lib/format';
import { RateAdjustCard } from './RateAdjustCard';
import { BalanceChart } from './BalanceChart';

export function ResultScreen() {
  const { input, goTo } = useMortgageStore();
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'failed'>('idle');

  const result = useMemo(() => computeResult(input), [input]);
  const schedule = useMemo(() => buildAmortizationSchedule(input), [input]);
  const impact = useMemo(() => fixedPeriodImpact(input), [input]);
  const divergence = useMemo(() => monthlyPaymentDivergence(input), [input]);
  const baseRate = safeNumber(input.rate);
  const inputMonthly = safeNumber(input.monthlyPayment);
  const isEqualPrincipal = input.repayMethod === 'equal-principal';
  const isFixedPeriod = input.rateType === 'fixed-period';

  const presets = useMemo(
    () =>
      RATE_PRESETS.map((delta) =>
        rateScenario(input.balance, baseRate, input.remainingYears, delta, input.repayMethod),
      ),
    [input.balance, baseRate, input.remainingYears, input.repayMethod],
  );

  const t = strings.result;
  const ms = t.monthlySection;
  // 入力額との差 = 入力した毎月返済額 − 参考月返済額
  const monthlyDiff = inputMonthly > 0 ? inputMonthly - result.referenceMonthly : null;

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

        {/* 毎月返済額の確認（参考 / 入力 / 差） */}
        <section className="collapsible collapsible--card panel">
          <h2 className="section-heading" style={{ marginTop: 0 }}>
            {ms.heading}
          </h2>
          <dl className="kv">
            {isEqualPrincipal ? (
              <>
                <KV label={ms.referenceFirstLabel} value={yenPerMonth(result.referenceMonthlyFirst)} />
                <KV label={ms.referenceAverageLabel} value={yenPerMonth(result.referenceMonthlyAverage)} />
              </>
            ) : (
              <KV label={ms.referenceLabel} value={yenPerMonth(result.referenceMonthly)} />
            )}
            <KV
              label={ms.inputLabel}
              value={
                inputMonthly > 0 ? `${yenPerMonth(inputMonthly)}（${input.monthlyPaymentSource === 'manual' ? ms.manualTag : ms.autoTag}）` : '—'
              }
            />
            {monthlyDiff != null && (
              <KV label={ms.diffLabel} value={`${signedYen(monthlyDiff)} / 月`} emphasize />
            )}
          </dl>
          {divergence.significant && <p className="notice">{ms.divergenceNotice}</p>}
          {isEqualPrincipal && <p className="muted panel__note">{ms.equalPrincipalNote}</p>}
          <p className="muted panel__note">{ms.note}</p>
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
              <span role="cell">
                {yenPerMonth(inputMonthly > 0 ? inputMonthly : result.referenceMonthly)}
              </span>
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
                <span role="cell">
                  {yenPerMonth(
                    inputMonthly > 0 ? inputMonthly + p.monthlyIncrease : p.referenceMonthly,
                  )}
                </span>
                <span className="is-up" role="cell">
                  {signedYen(p.annualIncrease)}
                </span>
                <span className="is-up" role="cell">
                  {signedMan(p.remainingTotalIncrease)}
                </span>
              </div>
            ))}
          </div>
          <p className="muted preset-note">
            {inputMonthly > 0 ? t.presetNoteInput : t.presetNoteReference}
          </p>
        </section>

        {/* 1年ごとのローン残高推移グラフ */}
        <section className="collapsible collapsible--card panel">
          <h2 className="section-heading" style={{ marginTop: 0 }}>
            {t.balanceChart.heading}
          </h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {t.balanceChart.lead}
          </p>
          <BalanceChart schedule={schedule} />
          <p className="muted panel__note">
            {schedule.paymentBasis === 'input'
              ? t.balanceChart.basisInput
              : t.balanceChart.basisReference}
          </p>
          {schedule.inputPaymentFellBack && (
            <p className="muted panel__note">{t.balanceChart.basisFallback}</p>
          )}
          <p className="muted panel__note">{t.balanceChart.note}</p>
          {safeNumber(input.bonusAnnual) > 0 && (
            <p className="muted panel__note">{t.balanceChart.bonusNote}</p>
          )}
        </section>

        {/* 固定期間終了後シミュレーション（固定期間選択型のみ） */}
        {isFixedPeriod && (
          <section className="collapsible collapsible--card panel">
            <h2 className="section-heading" style={{ marginTop: 0 }}>
              {t.fixedPeriod.heading}
            </h2>
            {impact.configured ? (
              <>
                <dl className="kv">
                  <KV label={t.fixedPeriod.endAge} value={`${Math.round(impact.endAge)} 歳`} />
                  <KV label={t.fixedPeriod.balanceAtEnd} value={man(impact.balanceAtEnd)} />
                  <KV label={t.fixedPeriod.postRate} value={percent(impact.postRate)} />
                  <KV label={t.fixedPeriod.postMonthly} value={yenPerMonth(impact.postMonthly)} />
                  <KV
                    label={t.fixedPeriod.monthlyIncrease}
                    value={`${signedYen(impact.monthlyIncrease)} / 月`}
                    emphasize
                  />
                  <KV
                    label={t.fixedPeriod.annualIncrease}
                    value={`${signedYen(impact.annualIncrease)} / 年`}
                    emphasize
                  />
                </dl>
                <p className="muted panel__note">{t.fixedPeriod.note}</p>
              </>
            ) : (
              <>
                <p className="panel__unset">{t.fixedPeriod.unsetLabel}</p>
                <p className="muted panel__note">{t.fixedPeriod.unsetHint}</p>
              </>
            )}
          </section>
        )}

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
              {isFixedPeriod && (
                <>
                  <Row
                    label={strings.input.fields.fixedPeriodRemainingYears.label}
                    value={`${safeNumber(input.fixedPeriodRemainingYears)} 年`}
                  />
                  <Row
                    label={strings.input.fields.postFixedRate.label}
                    value={input.postFixedRate != null ? percent(safeNumber(input.postFixedRate)) : '未設定'}
                  />
                </>
              )}
              <Row label={strings.input.fields.remainingYears.label} value={`${safeNumber(input.remainingYears)} 年`} />
              <Row label={strings.input.fields.repayMethod.label} value={strings.repayMethodLabels[input.repayMethod]} />
              <Row label={strings.input.fields.bonusAnnual.label} value={yen(safeNumber(input.bonusAnnual))} />
              <Row
                label={strings.input.fields.monthlyPayment.label}
                value={`${yenPerMonth(inputMonthly)}（${input.monthlyPaymentSource === 'manual' ? ms.manualTag : ms.autoTag}）`}
              />
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

function KV({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="kv__row">
      <dt className="muted">{label}</dt>
      <dd className={emphasize ? 'is-up' : ''}>{value}</dd>
    </div>
  );
}
