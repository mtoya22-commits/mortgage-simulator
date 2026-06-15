// 選択肢入力（金利タイプ / 返済方式）。shared-tokens の .choice 系を使う。

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

interface ChoiceFieldProps<T extends string> {
  options: ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function ChoiceField<T extends string>({
  options,
  value,
  onChange,
}: ChoiceFieldProps<T>) {
  return (
    <div className="choice-group" role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className={`choice${value === opt.value ? ' choice--selected' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
