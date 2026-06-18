/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 総合版（life-plan-lab）の本番 URL を上書きする任意の環境変数。 */
  readonly VITE_LIFE_PLAN_LAB_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
