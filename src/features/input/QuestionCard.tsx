// 質問カード: 題目 + ？ヘルプ + 入力フィールド。
// 1 枚スクロール入力の基本ブロック（DESIGN_HANDOFF.md 3章 / 7章）。

import type { ReactNode } from 'react';
import { HelpTooltip } from './HelpTooltip';

interface QuestionCardProps {
  label: string;
  help?: string;
  /** ラベル右の補足（任意・未入力OK の合図など） */
  hint?: string;
  children: ReactNode;
}

export function QuestionCard({ label, help, hint, children }: QuestionCardProps) {
  return (
    <section className="qcard">
      <div className="qcard__head">
        <span className="qcard__label">{label}</span>
        {help && <HelpTooltip text={help} />}
      </div>
      {children}
      {hint && <p className="qcard__hint muted">{hint}</p>}
    </section>
  );
}
