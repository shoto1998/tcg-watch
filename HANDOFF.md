# tcg-watch 引き継ぎメモ（2026-09-29 時点）

ポケカ・ワンピ・遊戯王の抽選に漏れなく応募するための個人用ツール。ランニングコスト0円。

## 方針（決まったこと）

- 抽選情報の収集と応募管理は **[トレゲト](https://cardchusen.com/)** に任せる（全国の抽選・応募リンク・LINE締切通知・応募管理がある）
- 自作側は「毎日トレゲトで応募する習慣」を作ることに絞る。完了を記録し、週ごとの完了率で振り返る
- 抽選への自動応募はしない（各店の規約で本人・1人1回。当選取消の対象になる）
- 規約でスクレイピングを禁止しているサイト（ポケモンセンターオンライン、Amazon、トレゲト）は自動取得しない

## 動いているもの

| 仕組み | タイミング | 内容 |
|---|---|---|
| 習慣タスク（`habit.yml`） | 毎朝 JST 7:50（cron-job.org から起動。予備で GitHub schedule 9:27） | 「📝 今日のトレゲトで抽選に応募」の Issue を作り LINE / Discord に通知。LINE には「トレゲトを開く」「完了した」ボタン。前日の未完了は未達として閉じる。月曜は前週の完了率 |
| 公式サイト巡回（`collect.yml`） | JST 7:50 / 19:50 | ポケカ公式（お知らせ）、ワンピ公式（商品）、ゲオ、HMV を巡回し、新BOX・抽選告知を通知（X 検索リンク付き） |
| サイト | 常時 | https://shoto1998.github.io/tcg-watch/ 「今日」タブで完了ボタンと直近4週の完了率。`#settings` で GitHub トークン設定 |

### 完了の記録

LINE の「完了した」→ 普段のブラウザでサイトが開き、`?done=Issue番号` を見て Issue を「完了」で閉じる。
ブラウザごとに GitHub トークン（tcg-watch の Issues: Read and write）の登録が必要（スマホの Safari には登録済み）。

## 止めているもの（コードは残してある）

| 仕組み | 状態 | 再開方法 |
|---|---|---|
| X 投稿の取得（`xposts.yml`、Xpoz） | schedule を外して停止。Xpoz 無料枠（一回限り500クレジット）はほぼ未使用 | `xposts.yml` に schedule を戻す |
| 投稿→抽選タスク化のルーティン（`ROUTINE.md`） | Claude Code のルーティンは削除、専用セッションはアーカイブ済み | リポジトリを付けたセッションを作り、persistent_session_id 指定でルーティンを作り直す |
| 抽選タスク（ラベル `tcg-task` の Issue、サイト「タスク」タブ） | 新規作成は止まっている。#1・#2（Amazon 招待）が残っている | 上のルーティンを再開 |

## Secrets（Settings → Secrets and variables → Actions）

- `DISCORD_WEBHOOK_URL`: Discord 通知（不要になれば削除でよい）
- `LINE_CHANNEL_ACCESS_TOKEN`: LINE 公式アカウント（Messaging API）の長期トークン。broadcast で送る。無料枠は月200通
- `XPOZ_API_KEY`: X 投稿取得（停止中）

## 未完了・次にやるなら

- [ ] **cron-job.org の設定**（未確認）: `habit.yml` と `collect.yml` の `/dispatches` に POST するジョブを2つ。
      ヘッダ `Authorization: Bearer <Actions: Read and write のトークン>`、`Accept: application/vnd.github+json`、
      `X-GitHub-Api-Version: 2022-11-28`、本文 `{"ref":"main"}`。TEST RUN で 204 なら成功。
      未設定のあいだは GitHub schedule（数時間遅れることがある）だけで動く
- [ ] 応募済み抽選の結果発表日をカレンダー登録し、発表日に「結果を確認したか」を LINE で聞く機能（案のみ）。
      応募URLに電話番号・生年月日が含まれることがあるので、公開リポジトリ（Issue）には載せないこと
- [ ] 近所のコンビニ巡回の習慣化（発売日に合わせてタスクを出す案。今回は見送り）
- [ ] 遊戯王公式の商品一覧は JS 描画で自動取得できていない

## 経緯メモ

- 最初は公式サイト＋店舗サイトの巡回で作ったが、ポケセン・Amazon は規約で禁止、イオン・あみあみは 403、晴れる屋2 は robots.txt で禁止、ヤマダ・楽天・遊戯王公式は JS 描画で取得できず
- X から Xpoz で拾う方式も作ったが、1日45件程度で網羅性が低く、トレゲトに大きく劣るため停止
- GitHub Actions の schedule が 7時間以上遅れたため、起動を cron-job.org に移した
