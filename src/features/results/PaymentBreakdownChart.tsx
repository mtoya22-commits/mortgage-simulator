// 1年ごとの返済額の内訳（元金・利息）積み上げグラフ（自作SVG, 依存追加なし）。
// 横軸=年齢、縦軸=毎月返済額。下band=元金、上band=利息（赤は使わずブラウン）。
// ボーナス返済は含まない（スケジュール返済の内訳）。

import { useMemo } from 'react';
import type { AmortizationSchedule } from '../../types/mortgage';
import { strings } from '../../strings/ja';
import { man } from '../../lib/format';

interface PaymentBreakdownChartProps {
  schedule: AmortizationSchedule;
  /** 横軸ラベルに年齢を使うか（false なら経過年数） */
  useAge?: boolean;
}

// viewBox 座標（残高グラフと同じ寸法で揃える）
const W = 320;
const H = 180;
const PAD = { top: 12, right: 12, bottom: 26, left: 44 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

export function PaymentBreakdownChart({ schedule, useAge = true }: PaymentBreakdownChartProps) {
  const t = strings.result.paymentChart;
  const { breakdown } = schedule;

  const geom = useMemo(() => {
    if (breakdown.length < 1) return null;
    // 左端（year 0）を 1 年目の値で補い、面が左端から始まるようにする
    const first = breakdown[0];
    const pts = [{ year: 0, age: first.age - 1, principal: first.principal, interest: first.interest }, ...breakdown];

    const maxYear = breakdown[breakdown.length - 1].year || 1;
    const maxPayment = Math.max(...breakdown.map((b) => b.principal + b.interest), 1);

    const x = (year: number) => PAD.left + (year / maxYear) * PLOT_W;
    const y = (yen: number) => PAD.top + (1 - yen / maxPayment) * PLOT_H;

    // 下band（元金）: 上端 = y(principal)、ベースライン y(0)
    const principalArea =
      `M${x(0).toFixed(1)},${y(0).toFixed(1)} ` +
      pts.map((p) => `L${x(p.year).toFixed(1)},${y(p.principal).toFixed(1)}`).join(' ') +
      ` L${x(maxYear).toFixed(1)},${y(0).toFixed(1)} Z`;

    // 上band（利息）: 上端 = y(principal+interest)、下端 = y(principal) を逆順で
    const interestTop = pts.map((p) => `${x(p.year).toFixed(1)},${y(p.principal + p.interest).toFixed(1)}`);
    const principalTopRev = [...pts]
      .reverse()
      .map((p) => `${x(p.year).toFixed(1)},${y(p.principal).toFixed(1)}`);
    const interestArea =
      `M${interestTop[0]} ` +
      interestTop.slice(1).map((p) => `L${p}`).join(' ') +
      ' ' +
      principalTopRev.map((p) => `L${p}`).join(' ') +
      ' Z';

    // 元金の上端線（区切り）
    const principalLine = pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.year).toFixed(1)},${y(p.principal).toFixed(1)}`)
      .join(' ');

    const baseAge = first.age - 1;
    const label = (year: number) => (useAge ? `${baseAge + year}` : `${year}`);

    return { maxYear, maxPayment, x, y, principalArea, interestArea, principalLine, label };
  }, [breakdown, useAge]);

  if (!geom) {
    return (
      <p className="muted" style={{ margin: 0 }}>
        {t.empty}
      </p>
    );
  }

  const { maxYear, maxPayment, x, y, principalArea, interestArea, principalLine, label } = geom;

  const yTicks = [0, maxPayment / 2, maxPayment];
  const xTicks = Array.from(new Set([0, Math.round(maxYear / 2), maxYear]));

  return (
    <figure className="chart">
      <div className="chart-legend">
        <span className="chart-legend__item">
          <span className="chart-legend__swatch chart-legend__swatch--principal" />
          {t.legendPrincipal}
        </span>
        <span className="chart-legend__item">
          <span className="chart-legend__swatch chart-legend__swatch--interest" />
          {t.legendInterest}
        </span>
      </div>
      <svg
        className="chart__svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${t.heading}。${useAge ? t.axisAge : '経過年数'}に対する${t.axisPayment}の内訳。`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* 縦軸グリッド + 目盛り（万円。毎月の桁なので小さめ） */}
        {yTicks.map((tick, i) => (
          <g key={`y${i}`}>
            <line x1={PAD.left} y1={y(tick)} x2={W - PAD.right} y2={y(tick)} className="chart__grid" />
            <text x={PAD.left - 6} y={y(tick) + 3} className="chart__ylabel" textAnchor="end">
              {man(tick)}
            </text>
          </g>
        ))}

        {/* 積み上げ: 元金（下）→ 利息（上） */}
        <path d={principalArea} className="chart__area chart__area--principal" />
        <path d={interestArea} className="chart__area chart__area--interest" />
        <path d={principalLine} className="chart__line chart__line--principal" />

        {/* 横軸ラベル */}
        {xTicks.map((tick, i) => (
          <text
            key={`x${i}`}
            x={x(tick)}
            y={H - 8}
            className="chart__xlabel"
            textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
          >
            {label(tick)}
            {useAge ? '歳' : '年'}
          </text>
        ))}
      </svg>
    </figure>
  );
}
