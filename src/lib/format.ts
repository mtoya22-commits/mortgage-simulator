// 表示用の整形ユーティリティ。計算結果（円・%）を読みやすい日本語表記にする。

/**
 * 入力文字列を数値へ正規化する（純粋関数）。
 * 全角数字/全角ピリオド/全角マイナスを半角化し、カンマ・空白・「円 ¥ %」を除去してから解釈する。
 * 空・解釈不能・非有限は null（＝未入力扱い）。日本語モバイル入力に強くするため。
 */
export function parseNumericInput(raw: string): number | null {
  if (raw == null) return null;
  // 全角英数記号を半角へ（0xFF01-0xFF5E → 0x21-0x7E）、全角スペースも半角に
  const halfWidth = raw
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ');
  // カンマ・空白・通貨/単位記号を除去
  const cleaned = halfWidth.replace(/[,\s円¥￥%％]/g, '').trim();
  if (cleaned === '') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** 円を整数でカンマ区切りに（例: 1234567 → "1,234,567 円"）。 */
export function yen(value: number): string {
  return `${Math.round(safe(value)).toLocaleString('ja-JP')} 円`;
}

/**
 * 円を「万円」表記に（生活設計のスケールに合わせる）。
 * 例: 12340000 → "1,234 万円"。端数は四捨五入。
 */
export function man(value: number): string {
  const m = Math.round(safe(value) / 10000);
  return `${m.toLocaleString('ja-JP')} 万円`;
}

/** 月額の円（小数なし）。例: 87654 → "87,654 円/月"。 */
export function yenPerMonth(value: number): string {
  return `${Math.round(safe(value)).toLocaleString('ja-JP')} 円/月`;
}

/** 金利 %（小数 maxDigits 桁まで）。例: 0.925 → "0.925%"。 */
export function percent(value: number, maxDigits = 3): string {
  const v = safe(value);
  return `${v.toLocaleString('ja-JP', { maximumFractionDigits: maxDigits })}%`;
}

/** 符号付きの円（差額表示用）。例: +1200 → "+1,200 円"、-300 → "-300 円"。 */
export function signedYen(value: number): string {
  const v = Math.round(safe(value));
  const sign = v > 0 ? '+' : v < 0 ? '−' : '±';
  return `${sign}${Math.abs(v).toLocaleString('ja-JP')} 円`;
}

/** 符号付きの万円（残り総額の影響など、大きな差額向け）。 */
export function signedMan(value: number): string {
  const m = Math.round(safe(value) / 10000);
  const sign = m > 0 ? '+' : m < 0 ? '−' : '±';
  return `${sign}${Math.abs(m).toLocaleString('ja-JP')} 万円`;
}

function safe(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
