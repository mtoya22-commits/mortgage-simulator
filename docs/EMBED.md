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
  var MESSAGE_TYPE = 'lifeplanlab:resize';

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || data.type !== MESSAGE_TYPE) return;

    // source 属性で対象 iframe を特定（複数シミュレーター対応）
    var frames = document.querySelectorAll('iframe.lifeplanlab-frame');
    for (var i = 0; i < frames.length; i++) {
      var frame = frames[i];
      // セキュリティ: 実際にこの iframe から来たメッセージかを確認
      if (event.source !== frame.contentWindow) continue;
      if (data.source && frame.getAttribute('data-lifeplanlab-source') !== data.source) continue;

      var h = Math.max(MIN_HEIGHT, parseInt(data.height, 10) || 0);
      frame.style.height = h + 'px';
      break;
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
