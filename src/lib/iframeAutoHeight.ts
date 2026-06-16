// iframe 自動高さ。React アプリの実コンテンツ高さを親ページ（WordPress 等）へ
// postMessage で送り、親が iframe.style.height を更新できるようにする。
// 生活設計シミュレーターや今後の小型シミュレーターでも流用できるよう、
// メッセージ type は共通（IFRAME_MESSAGE_TYPE）にする。

import { useEffect } from 'react';

/** 全シミュレーター共通のリサイズ通知 type。親はこの type で判定する。 */
export const IFRAME_MESSAGE_TYPE = 'lifeplanlab:resize';

/** このアプリの識別子（複数 iframe を 1 ページに置くときの振り分け用）。 */
export const APP_SOURCE = 'mortgage-simulator';

/** 高さの最低値（px）。極端に小さい値で iframe が潰れるのを防ぐ。 */
export const DEFAULT_MIN_HEIGHT = 320;

export interface ResizeMessage {
  type: typeof IFRAME_MESSAGE_TYPE;
  /** どのシミュレーターから来たか */
  source: string;
  /** コンテンツ高さ（px, 最低値でクランプ済み） */
  height: number;
}

/** 親へ送るメッセージを組み立てる（純粋関数, テスト容易）。 */
export function buildResizeMessage(source: string, height: number): ResizeMessage {
  return { type: IFRAME_MESSAGE_TYPE, source, height };
}

/**
 * 計測した複数の高さ候補から、最低値でクランプした送信高さを決める。
 * 有限かつ正の候補だけを使い、なければ最低値を返す（純粋関数）。
 */
export function pickHeight(measurements: number[], minHeight: number): number {
  const valid = measurements.filter((v) => Number.isFinite(v) && v > 0);
  return Math.max(minHeight, ...(valid.length ? valid : [0]));
}

export interface AutoHeightOptions {
  /** 送信元の識別子（既定: APP_SOURCE） */
  source?: string;
  /** 高さの最低値（既定: DEFAULT_MIN_HEIGHT） */
  minHeight?: number;
}

/**
 * 現在のコンテンツ高さを親へ送り続ける hook。
 * 画面遷移・入力変更・結果表示は DOM 変化として MutationObserver が、
 * サイズ変化は ResizeObserver / window resize が拾い、フォント読込後も再送する。
 * 同じ高さなら送らない（無駄な再送・ループを防ぐ）。
 */
export function useIframeAutoHeight(options: AutoHeightOptions = {}): void {
  const source = options.source ?? APP_SOURCE;
  const minHeight = options.minHeight ?? DEFAULT_MIN_HEIGHT;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    let raf = 0;
    let last = -1;

    const measure = () => {
      raf = 0;
      const docEl = document.documentElement;
      const body = document.body;
      const height = pickHeight(
        [
          docEl?.scrollHeight ?? 0,
          docEl?.offsetHeight ?? 0,
          body?.scrollHeight ?? 0,
          body?.offsetHeight ?? 0,
        ],
        minHeight,
      );
      if (height === last) return;
      last = height;
      try {
        window.parent.postMessage(buildResizeMessage(source, height), '*');
      } catch {
        /* 親が無い / クロスオリジン制約でも落とさない */
      }
    };

    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };

    // 初回送信
    schedule();

    const ro = new ResizeObserver(schedule);
    if (document.documentElement) ro.observe(document.documentElement);
    if (document.body) ro.observe(document.body);

    const mo = new MutationObserver(schedule);
    if (document.body) {
      mo.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
    }

    window.addEventListener('resize', schedule);
    window.addEventListener('load', schedule);
    // フォント読込で高さが変わることがあるので、確定後にもう一度送る
    document.fonts?.ready?.then(schedule).catch(() => {});

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('load', schedule);
    };
  }, [source, minHeight]);
}
