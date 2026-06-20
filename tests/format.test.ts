import { describe, it, expect } from 'vitest';
import { parseNumericInput } from '../src/lib/format';

describe('parseNumericInput', () => {
  it('通常の半角数字を読む', () => {
    expect(parseNumericInput('30000000')).toBe(30_000_000);
    expect(parseNumericInput('0.925')).toBe(0.925);
  });

  it('カンマ区切りを受理する', () => {
    expect(parseNumericInput('30,000,000')).toBe(30_000_000);
    expect(parseNumericInput('1,234')).toBe(1234);
  });

  it('全角数字・全角ピリオドを半角化して読む', () => {
    expect(parseNumericInput('３０００００００')).toBe(30_000_000);
    expect(parseNumericInput('０．９２５')).toBe(0.925);
    expect(parseNumericInput('１，２３４')).toBe(1234); // 全角カンマ
  });

  it('単位記号・空白を除去する', () => {
    expect(parseNumericInput('85000 円')).toBe(85_000);
    expect(parseNumericInput('¥85,000')).toBe(85_000);
    expect(parseNumericInput('0.925%')).toBe(0.925);
    expect(parseNumericInput('　1000　')).toBe(1000); // 全角スペース
  });

  it('空・不正は null', () => {
    expect(parseNumericInput('')).toBeNull();
    expect(parseNumericInput('   ')).toBeNull();
    expect(parseNumericInput('abc')).toBeNull();
    expect(parseNumericInput('円')).toBeNull();
  });
});
