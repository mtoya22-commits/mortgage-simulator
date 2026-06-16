// phase に応じて画面を出し分けるルート。intro → input → result。

import { useMortgageStore } from './store/useMortgageStore';
import { useIframeAutoHeight } from './lib/iframeAutoHeight';
import { IntroScreen } from './features/intro/IntroScreen';
import { InputScreen } from './features/input/InputScreen';
import { ResultScreen } from './features/results/ResultScreen';

export default function App() {
  // コンテンツ高さを親ページ（WordPress 等）へ送り、二重スクロールを避ける
  useIframeAutoHeight();

  const phase = useMortgageStore((s) => s.phase);

  switch (phase) {
    case 'input':
      return <InputScreen />;
    case 'result':
      return <ResultScreen />;
    case 'intro':
    default:
      return <IntroScreen />;
  }
}
