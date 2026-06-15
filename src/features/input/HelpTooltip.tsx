// 「？」ヘルプ。タップで開き、外側タップ / Escape で閉じる。
// 用語解説ではなく「どこを見れば入力できるか」の案内に使う（DESIGN_HANDOFF.md 3章）。

import { useEffect, useId, useRef, useState } from 'react';

interface HelpTooltipProps {
  text: string;
  label?: string;
}

export function HelpTooltip({ text, label = 'ヘルプ' }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="help" ref={ref}>
      <button
        type="button"
        className="help__btn"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open && (
        <div className="help__bubble" id={id} role="tooltip">
          {text}
        </div>
      )}
    </div>
  );
}
