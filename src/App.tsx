// phase に応じて画面を出し分けるルート。intro → input → result。

import { useMortgageStore } from './store/useMortgageStore';
import { IntroScreen } from './features/intro/IntroScreen';
import { InputScreen } from './features/input/InputScreen';
import { ResultScreen } from './features/results/ResultScreen';

export default function App() {
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
