// 巡回先。kind: 'product' は公式の新商品、'lottery' は店舗の抽選・予約告知。
// selector は告知一覧のコンテナを絞るためのもの。構造が分からない間は 'a' で全リンクを見る。
//
// 規約でクローラ・自動取得を禁止しているサイトは入れない:
//   - ポケモンセンターオンライン（利用規約 第6条） https://www.pokemoncenter-online.com/terms.html
//   - Amazon（利用規約） https://www.amazon.co.jp/gp/help/customer/display.html?nodeId=643006
// これらは MANUAL_LINKS と X 検索で補う。
//
// 2026-09-28 の初回実行で自動取得できなかったため手動確認に回したもの:
//   イオン・あみあみ（HTTP 403）、晴れる屋2（robots.txt で /blogs を禁止）、
//   ヤマダ（ボット対策ページのみ返る）、セブンネット（特集URLが404）、
//   遊戯王公式の商品一覧・楽天ブックスの抽選ページ（JS で描画しており HTML に一覧が無い）
export const SOURCES = [
  // 商品一覧(/products/)は JS 描画なので、静的なお知らせ一覧を見る。
  // 見出しは「商品 …」「その他 …」のようにカテゴリ名から始まる。大会・グッズ紹介は除く
  {
    id: 'pokemon-official', name: 'ポケカ公式', kind: 'product', game: 'pokemon', url: 'https://www.pokemon-card.com/info/',
    match: /^商品 |抽選|追加販売|発売決定/,
    exclude: /^(イベント|コラム) |シティリーグ|チャンピオン|デッキシールド|デッキケース|プレイマット|周辺グッズ|ショッピングバッグ|フィギュア|動画/,
  },
  // 商品詳細ページ（/products/op18.html など）だけを見る。カテゴリ一覧のリンクは除く
  { id: 'onepiece-official', name: 'ワンピ公式', kind: 'product', game: 'onepiece', url: 'https://www.onepiece-cardgame.com/products/', urlInclude: /\/products\/[\w-]+\.html$/ },

  { id: 'geo', name: 'ゲオ', kind: 'lottery', url: 'https://geo-online.co.jp/news/' },
  { id: 'hmv', name: 'HMV', kind: 'lottery', url: 'https://www.hmv.co.jp/news/' },
];

// 告知が X 中心の店舗アカウント。新BOXごとに「商品名 + from:店舗」の検索リンクを作る。
export const STORE_X_ACCOUNTS = [
  'GEO_official', 'hareruya2pokeca', 'Yodobashi_X', '7_netshopping', 'cardrush_poke',
];

// 自動巡回しないが、サイトから1タップで確認したいページ。
export const MANUAL_LINKS = [
  { name: 'ポケモンセンターオンライン お知らせ', url: 'https://www.pokemoncenter-online.com/news/' },
  { name: 'ポケモンセンターオンライン 抽選', url: 'https://www.pokemoncenter-online.com/lottery/landing-page.html' },
  { name: 'ヨドバシ 人気商品抽選', url: 'https://limited.yodobashi.com/' },
  { name: 'ビックカメラ 抽選販売の案内（店頭受付）', url: 'https://www.biccamera.com/bc/c/info/order/lottery.jsp' },
  { name: 'ノジマ ポケカ', url: 'https://online.nojima.co.jp/contents/pokemon/' },
  { name: 'Joshin 予約一覧', url: 'https://joshinweb.jp/toy/48712.html' },
  { name: 'トイザらス 予約商品', url: 'https://www.toysrus.co.jp/ja-jp/whats-on/new-arrivals/preorder-2/' },
  { name: 'イオン 抽選販売', url: 'https://aeonretail.com/list/k-chusenhanbai/' },
  { name: 'あみあみ お知らせ', url: 'https://www.amiami.jp/top/page/t/attention.html' },
  { name: '晴れる屋2 ニュース', url: 'https://www.hareruya2.com/blogs/news' },
  { name: 'ヤマダデンキ お知らせ', url: 'https://www.yamada-denki.jp/information/' },
  { name: '楽天ブックス トレカ抽選', url: 'https://books.rakuten.co.jp/event/game/card/entry/' },
  { name: '遊戯王OCG 商品情報', url: 'https://www.yugioh-card.com/japan/products/' },
];
