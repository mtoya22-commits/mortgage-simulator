# WordPress 固定ページへの iframe 埋め込み（自動高さ）

住宅ローンシミュレーター（および今後の小型シミュレーター）を、二重スクロールなしで
WordPress 固定ページに埋め込むための手順です。

## 仕組み

- React アプリが、現在のコンテンツ高さを親ページへ `postMessage` で送ります
  （画面遷移・入力変更・結果表示・リサイズ・フォント読込時に再送）。
- メッセージは全シミュレーター共通の形式です：

  ```json
  { "type": "lifeplanlab:resize", "source": "mortgage-simulator", "height": 1234 }
  ```

- 親ページは `scrolling="no"` の iframe を置き、受け取った高さで `iframe.style.height`
  を更新します。これでスクロールは親ページの 1 本だけになり、下部の「結果を見る」
  ボタンが隠れません。
- アプリは iframe 内で表示されていることを検知すると、入力画面を `100svh` の内スクロール
  ではなく自然な高さで描画します（親スクロールに統一）。
- 画面遷移（入力画面・結果画面へ移動）時に、アプリは先頭へスクロールする依頼も送ります：

  ```json
  { "type": "lifeplanlab:scrollTop", "source": "mortgage-simulator" }
  ```

  親ページはこれを受けて iframe の先頭を画面上端へスクロールします（中ほどに着地して
  分かりにくくなるのを防ぐため）。

## 貼り付けコード（WordPress 固定ページの「カスタムHTML」ブロック）

`src` は GitHub Pages などに公開した `index.html` の URL に置き換えてください。
複数のシミュレーターを同じページに置く場合は、`data-lifeplanlab-source` を各アプリの
`source`（住宅ローンなら `mortgage-simulator`）に合わせ、iframe を増やすだけで動きます。

```html
<iframe
  class="lifeplanlab-frame"
  data-lifeplanlab-source="mortgage-simulator"
  src="https://<あなたの公開先>/index.html"
  title="住宅ローン シミュレーター"
  scrolling="no"
  loading="lazy"
  style="width:100%; border:0; display:block; min-height:320px;"
></iframe>

<script>
(function () {
  var MIN_HEIGHT = 320; // アプリ側の最低値と揃える
  var RESIZE_TYPE = 'lifeplanlab:resize';
  var SCROLL_TOP_TYPE = 'lifeplanlab:scrollTop';

  // 送信元の iframe を特定（複数シミュレーター対応 + 偽メッセージ無視）
  function findFrame(event, data) {
    var frames = document.querySelectorAll('iframe.lifeplanlab-frame');
    for (var i = 0; i < frames.length; i++) {
      var frame = frames[i];
      if (event.source !== frame.contentWindow) continue; // この iframe からのメッセージか
      if (data.source && frame.getAttribute('data-lifeplanlab-source') !== data.source) continue;
      return frame;
    }
    return null;
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data) return;

    if (data.type === RESIZE_TYPE) {
      var frame = findFrame(event, data);
      if (!frame) return;
      var h = Math.max(MIN_HEIGHT, parseInt(data.height, 10) || 0);
      frame.style.height = h + 'px';
      return;
    }

    if (data.type === SCROLL_TOP_TYPE) {
      // 画面遷移時にアプリから依頼される。iframe の先頭を画面の上端へ。
      var target = findFrame(event, data);
      if (!target) return;
      target.scrollIntoView({ block: 'start' });
      return;
    }
  });
})();
</script>
```

## 補足

- `event.source !== frame.contentWindow` のチェックで、他サイトからの偽メッセージを無視
  します（高さ以外の情報は送受信しないため影響は限定的ですが、安全側に倒しています）。
- スマホで下部ボタンが隠れる場合は、まず iframe に `scrolling="no"` が付いているか、
  受信スクリプトが固定ページに入っているかを確認してください。
- アプリ側の最低高さは `src/lib/iframeAutoHeight.ts` の `DEFAULT_MIN_HEIGHT`（既定 320）。
  親の `MIN_HEIGHT` と揃えてください。
- **遷移時に先頭へスクロール**させるには、上記スニペットの `lifeplanlab:scrollTop` ハンドラを
  含む新しい版に更新してください。古い版（resize のみ）のままだと、埋め込み時は遷移後に
  ページ中ほどへ着地したままになります（単独表示では `window.scrollTo` で先頭に戻ります）。
