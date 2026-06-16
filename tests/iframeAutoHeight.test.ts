import { describe, it, expect } from 'vitest';
import {
  buildResizeMessage,
  pickHeight,
  IFRAME_MESSAGE_TYPE,
  APP_SOURCE,
} from '../src/lib/iframeAutoHeight';

describe('buildResizeMessage', () => {
  it('共通 type と source・height を持つメッセージを作る', () => {
    expect(buildResizeMessage(APP_SOURCE, 1200)).toEqual({
      type: IFRAME_MESSAGE_TYPE,
      source: 'mortgage-simulator',
      height: 1200,
    });
  });

  it('type は全シミュレーター共通の値', () => {
    expect(IFRAME_MESSAGE_TYPE).toBe('lifeplanlab:resize');
  });
});

describe('pickHeight', () => {
  it('候補の最大値を返す', () => {
    expect(pickHeight([800, 1200, 950], 320)).toBe(1200);
  });

  it('最低値を下回らない', () => {
    expect(pickHeight([100, 200], 320)).toBe(320);
    expect(pickHeight([], 320)).toBe(320);
  });

  it('NaN / Infinity / 0 以下は無視する', () => {
    expect(pickHeight([NaN, Infinity, -50, 0, 900], 320)).toBe(900);
    expect(pickHeight([NaN, -1], 320)).toBe(320);
  });
});
