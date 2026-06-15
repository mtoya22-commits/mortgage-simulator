// 1年ごとのローン残高推移グラフ（自作SVG, 依存追加なし）。
// 横軸=年齢、縦軸=残高。完済予定年と固定期間終了年を目印として表示する。
// 残高は 0 未満にしない・完済後は 0 で止める（計算側で保証済み）。

import { useMemo } from 'react';
import type { AmortizationSchedule } from '../../types/mortgage';
import { strings } from '../../strings/ja';
import { man } from '../../lib/format';

interface BalanceChartProps {
  schedule: AmortizationSchedule;
  /** 横軸ラベルに年齢を使うか（false なら経過年数） */
  useAge?: boolean;
}

// viewBox 座標（レスポンシブは preserveAspectRatio + width:100% で吸収）
const W = 320;
const H = 180;
const PAD = { top: 12, right: 12, bottom: 26, left: 44 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

export function BalanceChart({ schedule, useAge = true }: BalanceChartProps) {
  const t = strings.result.balanceChart;
  const { points, payoffYear, fixedPeriodEndYear } = schedule;

  const geom = useMemo(() => {
    if (points.length < 2) return null;
    const maxYear = points[points.length - 1].year || 1;
    const maxBalance = Math.max(...points.map((p) => p.balance), 1);

    const x = (year: number) => PAD.left + (year / maxYear) * PLOT_W;
    const y = (balance: number) => PAD.top + (1 - balance / maxBalance) * PLOT_H;

    const linePath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.year).toFixed(1)},${y(p.balance).toFixed(1)}`)
      .join(' ');
    const areaPath =
      `M${x(0).toFixed(1)},${y(0).toFixed(1)} ` +
      points.map((p) => `L${x(p.year).toFixed(1)},${y(p.balance).toFixed(1)}`).join(' ') +
      ` L${x(maxYear).toFixed(1)},${y(0).toFixed(1)} Z`;

    const baseAge = points[0].age;
    const label = (year: number) => (useAge ? `${baseAge + year}` : `${year}`);

    return { maxYear, maxBalance, x, y, linePath, areaPath, label, baseAge };
  }, [points, useAge]);

  if (!geom) {
    return (
      <p className="muted" style={{ margin: 0 }}>
        残高・残り年数を入力すると、ここに残高の推移が表示されます。
      </p>
    );
  }

  const { maxYear, maxBalance, x, y, linePath, areaPath, label } = geom;

  // 縦軸の目盛り（0 / 半分 / 最大）
  const yTicks = [0, maxBalance / 2, maxBalance];
  // 横軸の目盛り（始点・中間・終点）
  const xTicks = Array.from(new Set([0, Math.round(maxYear / 2), maxYear]));

  return (
    <figure className="chart">
      <svg
        className="chart__svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${t.heading}。${useAge ? t.axisAge : '経過年数'}に対する${t.axisBalance}の推移。`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* 縦軸グリッド + 目盛りラベル（万円） */}
        {yTicks.map((tick, i) => (
          <g key={`y${i}`}>
            <line
              x1={PAD.left}
              y1={y(tick)}
              x2={W - PAD.right}
              y2={y(tick)}
              className="chart__grid"
            />
            <text x={PAD.left - 6} y={y(tick) + 3} className="chart__ylabel" textAnchor="end">
              {man(tick)}
            </text>
          </g>
        ))}

        {/* 固定期間終了の目印（縦線） */}
        {fixedPeriodEndYear != null && fixedPeriodEndYear <= maxYear && (
          <g>
            <line
              x1={x(fixedPeriodEndYear)}
              y1={PAD.top}
              x2={x(fixedPeriodEndYear)}
              y2={PAD.top + PLOT_H}
              className="chart__marker chart__marker--fixed"
            />
            <text
              x={x(fixedPeriodEndYear)}
              y={PAD.top + 8}
              className="chart__markerlabel"
              textAnchor="middle"
            >
              {t.fixedEndMarker}
            </text>
          </g>
        )}

        {/* 残高エリア + ライン */}
        <path d={areaPath} className="chart__area" />
        <path d={linePath} className="chart__line" />

        {/* 完済予定の目印 */}
        {payoffYear != null && payoffYear <= maxYear && (
          <g>
            <circle cx={x(payoffYear)} cy={y(0)} r={3} className="chart__payoff-dot" />
            <text
              x={x(payoffYear)}
              y={y(0) - 6}
              className="chart__markerlabel"
              textAnchor={payoffYear >= maxYear ? 'end' : 'middle'}
            >
              {t.payoffMarker}
            </text>
          </g>
        )}

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
