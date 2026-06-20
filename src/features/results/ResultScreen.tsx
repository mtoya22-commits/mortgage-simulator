// 結果画面。Hero（主指標）→ 毎月返済額の確認 → 金利ステッパー → 金利上昇テーブル →
// 残高推移グラフ → 固定期間終了後シミュレーション → 入力条件 → 注記 → 次アクション。
// 長くなりすぎないよう詳細は collapsible / <details> で折りたたむ（モーダル不使用）。

import { useMemo, useState } from 'react';
import { useMortgageStore } from '../../store/useMortgageStore';
import { strings, RATE_PRESETS, LIFE_PLAN_LAB_URL } from '../../strings/ja';
import {
  computeResult,
  rateScenario,
  rateScenarioAt,
  buildAmortizationSchedule,
  fixedPeriodImpact,
  monthlyPaymentDivergence,
  estimateScenarioTotals,
  safeNumber,
} from '../../lib/mortgage';
import {
  buildMortgagePayload,
  saveMortgagePayload,
  type ScenarioSelection,
} from '../../lib/storage';
import { buildLifePlanUrl, isUsableLifePlanUrl } from '../../lib/lifePlanUrl';
import { yen, man, yenPerMonth, signedYen, signedMan, percent } from '../../lib/format';
import type { MortgageSource } from '../../types/mortgage';
import { RateAdjustCard } from './RateAdjustCard';
import { BalanceChart } from './BalanceChart';
import { PaymentBreakdownChart } from './PaymentBreakdownChart';

export function ResultScreen() {
  const { input, goTo } = useMortgageStore();
  const baseRate = safeNumber(input.rate);
  // 試算用の一時金利（ステッパーと「金利変更シナリオ反映」で共有）
  const [trialRate, setTrialRate] = useState<number>(baseRate);
  // どの条件を総合版へ反映するか（既定: 現在の返済条件）
  const [selectedSource, setSelectedSource] = useState<MortgageSource>('currentPlan');
  const [saveState, setSaveState] = useState<{ source: MortgageSource } | 'failed' | null>(null);

  const result = useMemo(() => computeResult(input), [input]);
  const schedule = useMemo(() => buildAmortizationSchedule(input), [input]);
  const impact = useMemo(() => fixedPeriodImpact(input), [input]);
  const divergence = useMemo(() => monthlyPaymentDivergence(input), [input]);
  // 現在条件の総支払額（現在の残高から完済までの概算）
  const currentTotals = useMemo(() => estimateScenarioTotals(input, input.rate), [input]);
  // 固定期間終了後の想定金利での総支払利息（configured 時のみ意味を持つ）
  const fixedTotals = useMemo(
    () => estimateScenarioTotals(input, impact.postRate),
    [input, impact.postRate],
  );
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
  const rf = t.reflect;
  const sourceLabels = strings.mortgageSourceLabels;
  // 入力額との差 = 入力した毎月返済額 − 参考月返済額
  const monthlyDiff = inputMonthly > 0 ? inputMonthly - result.referenceMonthly : null;

  // 現在の毎月返済額（入力があればそれ、無ければ参考額）
  const currentMonthly = inputMonthly > 0 ? inputMonthly : result.referenceMonthly;
  // 金利変更シナリオ: 試算金利での入力額起点の月返済額
  const trialScenario = useMemo(
    () => rateScenarioAt(input.balance, baseRate, input.remainingYears, trialRate, input.repayMethod),
    [input.balance, baseRate, input.remainingYears, trialRate, input.repayMethod],
  );
  const rateAdjustedMonthly =
    inputMonthly > 0 ? inputMonthly + trialScenario.monthlyIncrease : trialScenario.referenceMonthly;

  const fixedConfigured = isFixedPeriod && impact.configured;

  // 反映対象 source ごとの保存ペイロードを組み立てる
  const selectionFor = (source: MortgageSource): ScenarioSelection => {
    if (source === 'rateAdjusted') {
      return {
        source,
        selectedMonthlyYen: rateAdjustedMonthly,
        scenarioMonthlyYen: rateAdjustedMonthly,
        scenarioRate: trialRate,
        scenarioLabel: sourceLabels.rateAdjusted,
      };
    }
    if (source === 'fixedPeriodScenario') {
      return {
        source,
        selectedMonthlyYen: impact.postMonthly,
        scenarioMonthlyYen: impact.postMonthly,
        scenarioRate: impact.postRate,
        scenarioLabel: sourceLabels.fixedPeriodScenario,
      };
    }
    return { source: 'currentPlan', selectedMonthlyYen: currentMonthly };
  };

  const payloadFor = (source: MortgageSource) =>
    buildMortgagePayload(input, selectionFor(source));

  const handleReflect = (source: MortgageSource) => {
    const ok = saveMortgagePayload(payloadFor(source));
    setSelectedSource(source);
    setSaveState(ok ? { source } : 'failed');
  };

  // 選択中の source が総合版へ引き継ぐ毎月返済額
  const selectedMonthly = selectionFor(selectedSource).selectedMonthlyYen;

  // 資産推移リンク: 選択中の source の条件を URL に付与し、押下時に localStorage も保存
  const urlUsable = isUsableLifePlanUrl(LIFE_PLAN_LAB_URL);
  const viewLifePlanUrl = buildLifePlanUrl(LIFE_PLAN_LAB_URL, payloadFor(selectedSource));
  const handleViewLifePlan = () => {
    saveMortgagePayload(payloadFor(selectedSource));
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

        {/* 総支払額の目安（現在の残高から完済まで） */}
        <section className="collapsible collapsible--card panel">
          <h2 className="section-heading" style={{ marginTop: 0 }}>
            {t.totals.heading}
          </h2>
          <dl className="kv">
            <KV label={t.totals.totalPayment} value={man(currentTotals.totalPayment)} />
            <KV label={t.totals.totalInterest} value={man(currentTotals.totalInterest)} />
          </dl>
          <p className="muted panel__note">{t.totals.caption}</p>
        </section>

        {/* What-if を上に: 金利ステッパー */}
        <RateAdjustCard input={input} rate={trialRate} onRateChange={setTrialRate} />

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

        {/* 1年ごとの返済額の内訳（元金・利息） */}
        <section className="collapsible collapsible--card panel">
          <h2 className="section-heading" style={{ marginTop: 0 }}>
            {t.paymentChart.heading}
          </h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {t.paymentChart.lead}
          </p>
          <PaymentBreakdownChart schedule={schedule} />
          <p className="muted panel__note">{t.paymentChart.note}</p>
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
                  <KV label={t.totals.fixedLabel} value={man(fixedTotals.totalInterest)} />
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

        {/* 生活設計に反映する（総合版へ引き継ぐ） */}
        <section className="collapsible collapsible--card panel reflect">
          <h2 className="section-heading" style={{ marginTop: 0 }}>
            {rf.heading}
          </h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {rf.lead}
          </p>

          <ReflectButton
            label={rf.current.button}
            desc={rf.current.desc}
            value={yenPerMonth(currentMonthly)}
            badge={rf.selectedBadge}
            active={selectedSource === 'currentPlan'}
            onClick={() => handleReflect('currentPlan')}
          />
          <ReflectButton
            label={rf.rateAdjusted.button}
            desc={`${rf.rateAdjusted.desc}（金利 ${percent(trialRate)} → ${yenPerMonth(rateAdjustedMonthly)}）`}
            value={yenPerMonth(rateAdjustedMonthly)}
            badge={rf.selectedBadge}
            active={selectedSource === 'rateAdjusted'}
            onClick={() => handleReflect('rateAdjusted')}
          />
          {fixedConfigured && (
            <ReflectButton
              label={rf.fixedPeriod.button}
              desc={`${rf.fixedPeriod.desc}（金利 ${percent(impact.postRate)} → ${yenPerMonth(impact.postMonthly)}）`}
              value={yenPerMonth(impact.postMonthly)}
              badge={rf.selectedBadge}
              active={selectedSource === 'fixedPeriodScenario'}
              onClick={() => handleReflect('fixedPeriodScenario')}
            />
          )}

          {saveState && saveState !== 'failed' && (
            <p className="muted save-msg" role="status">
              {rf.savedPrefix}
              {sourceLabels[saveState.source]}
            </p>
          )}
          {saveState === 'failed' && <p className="muted save-msg">{rf.saveFailed}</p>}
        </section>

        {/* 次アクション */}
        <section className="result-actions">
          {/* 今どの条件・いくらを総合版へ渡すかの明示 */}
          <div className="handoff-summary">
            <p className="handoff-summary__line">
              {rf.selectedConditionPrefix}
              <strong>{sourceLabels[selectedSource]}</strong>
            </p>
            <p className="handoff-summary__line">
              {rf.carryPrefix}
              <strong>{yenPerMonth(selectedMonthly)}</strong>
            </p>
          </div>

          <button type="button" className="btn" onClick={() => goTo('input')}>
            {t.actions.recalc}
          </button>

          {urlUsable ? (
            <a
              className="btn btn--primary result-actions__link"
              href={viewLifePlanUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleViewLifePlan}
            >
              {rf.viewLifePlan}
            </a>
          ) : (
            <button type="button" className="btn result-actions__link" disabled>
              {rf.viewLifePlan}
            </button>
          )}
          <p className="muted save-msg">{urlUsable ? rf.viewLifePlanDesc : rf.urlUnset}</p>
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

function ReflectButton({
  label,
  desc,
  value,
  badge,
  active,
  onClick,
}: {
  label: string;
  desc: string;
  value: string;
  badge: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div className="reflect__item">
      <button
        type="button"
        className={`handoff-option${active ? ' handoff-option--selected' : ''}`}
        aria-pressed={active}
        data-selected={active}
        onClick={onClick}
      >
        <span className="handoff-option__main">
          <span className="handoff-option__label">{label}</span>
          {active && <span className="handoff-option__badge">{badge}</span>}
        </span>
        <span className="handoff-option__amount">{value}</span>
      </button>
      <p className="muted reflect__desc">{desc}</p>
    </div>
  );
}
