// 導入画面。このシミュレーターでできること / 簡易試算であること /
// 金利上昇の影響も参考確認できることを、煽らないトーンで伝える。

import { useMortgageStore } from '../../store/useMortgageStore';
import { strings } from '../../strings/ja';

export function IntroScreen() {
  const goTo = useMortgageStore((s) => s.goTo);
  const t = strings.intro;

  return (
    <div className="app">
      <div className="screen fade-rise">
        <header className="hero">
          <p className="hero__eyebrow">{strings.app.subtitle}</p>
          <h1 className="hero__title">{t.heading}</h1>
          <p className="hero__lead muted">{t.lead}</p>
        </header>

        <section className="collapsible" style={{ padding: '14px 18px' }}>
          <ul className="intro-list">
            {t.canDo.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        <p className="muted intro-note">{t.note}</p>

        <button
          type="button"
          className="btn btn--primary intro-start"
          onClick={() => goTo('input')}
        >
          {t.start}
        </button>
      </div>
    </div>
  );
}
