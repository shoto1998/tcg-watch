# tcg-watch

ポケカ・ワンピースカード・遊戯王の「新BOX」と「店舗の抽選・予約受付」を1日2回巡回し、Discord に通知します。
サイト（GitHub Pages）で受付中の抽選を締切順に確認し、応募済みにチェックできます。ランニングコストは0円です。

## 仕組み

- GitHub Actions が JST 7:50 / 19:50 に `npm run collect` を実行
- `src/sources.js` の巡回先を取得し、新しい告知だけを `docs/data/items.json` に追記してコミット
- 新BOXには X 検索リンク（全体 / 主要店舗アカウントのみ）を付ける
- 締切を読み取れた抽選は、締切24時間前にもう一度通知
- 巡回先が3回連続で失敗したら Discord に警告

抽選への応募は自動化しません（各店舗の規約で「本人・1人1回」とされており、自動応募は当選取消の対象になるため）。

## 巡回しないサイト

利用規約でクローラ・自動取得を禁止しているサイトは巡回しません。サイトの「巡回先」タブに手動確認リンクとして置いています。

- ポケモンセンターオンライン（利用規約 第6条）
- Amazon

どのサイトも `robots.txt` で禁止されたパスは取得しません。アクセスは各ページ1日2回だけです。

## セットアップ

1. Settings → Secrets and variables → Actions に `DISCORD_WEBHOOK_URL` を登録
2. Settings → Pages で Source を `Deploy from a branch`、`main` / `/docs` に設定
3. Actions → collect → Run workflow で初回実行（初回は既存の告知を記録するだけで通知しません）

## 巡回先を追加する

`src/sources.js` の `SOURCES` に1行追加します。

```js
{ id: 'shop', name: '店舗名', kind: 'lottery', url: 'https://example.jp/news/' }
```

一覧ページ内のリンクのうち、ゲーム名（ポケモンカード等）と抽選系の語（抽選・予約・応募など）を両方含むものを告知とみなします。
関係ないリンクを拾う場合は `selector`（一覧のコンテナ）や `include` / `exclude`（正規表現）で絞ります。

## ローカル実行

```sh
npm ci
npm test
npm run collect   # DISCORD_WEBHOOK_URL が無ければ通知内容を標準出力に出す
```
