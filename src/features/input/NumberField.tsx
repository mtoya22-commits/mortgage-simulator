// 数値入力。小数・空欄（未入力 = null）を扱い、フォーカス外で値を確定する。
// 入力中は文字列として保持し、確定時に number | null へ変換する。

import { useEffect, useState } from 'react';

interface NumberFieldProps {
  value: number | null;
  onChange: (value: number | null) => void;
  unit?: string;
  placeholder?: string;
  /** 小数を許可するか（金利は true、円・年・歳は基本 false 想定だが許容） */
  allowDecimal?: boolean;
  ariaLabel?: string;
}

export function NumberField({
  value,
  onChange,
  unit,
  placeholder,
  allowDecimal = true,
  ariaLabel,
}: NumberFieldProps) {
  // 表示用のローカル文字列。外部 value の変化に追従する。
  const [text, setText] = useState(value == null ? '' : String(value));

  useEffect(() => {
    setText(value == null ? '' : String(value));
  }, [value]);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '') {
      onChange(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      onChange(null);
      return;
    }
    onChange(parsed);
  };

  return (
    <div className="numfield">
      <input
        className="numfield__input"
        type="text"
        inputMode={allowDecimal ? 'decimal' : 'numeric'}
        value={text}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      {unit && <span className="numfield__unit">{unit}</span>}
    </div>
  );
}
