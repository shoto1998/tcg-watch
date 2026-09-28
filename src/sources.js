// 巡回先。kind: 'product' は公式の新商品、'lottery' は店舗の抽選・予約告知。
// selector は告知一覧のコンテナを絞るためのもの。構造が分からない間は 'a' で全リンクを見る。
//
// 規約でクローラ・自動取得を禁止しているサイトは入れない:
//   - ポケモンセンターオンライン（利用規約 第6条） https://www.pokemoncenter-online.com/terms.html
//   - Amazon（利用規約） https://www.amazon.co.jp/gp/help/customer/display.html?nodeId=643006
// これらは MANUAL_LINKS と X 検索で補う。
export const SOURCES = [
  { id: 'pokemon-official', name: 'ポケカ公式', kind: 'product', game: 'pokemon', url: 'https://www.pokemon-card.com/products/' },
  { id: 'onepiece-official', name: 'ワンピ公式', kind: 'product', game: 'onepiece', url: 'https://www.onepiece-cardgame.com/products/' },
  { id: 'yugioh-official', name: '遊戯王公式', kind: 'product', game: 'yugioh', url: 'https://www.yugioh-card.com/japan/products/' },

  { id: 'geo', name: 'ゲオ', kind: 'lottery', url: 'https://geo-online.co.jp/news/' },
  { id: 'hmv', name: 'HMV', kind: 'lottery', url: 'https://www.hmv.co.jp/news/' },
  { id: 'yamada', name: 'ヤマダデンキ', kind: 'lottery', url: 'https://www.yamada-denki.jp/information/' },
  { id: 'rakuten-books', name: '楽天ブックス', kind: 'lottery', url: 'https://books.rakuten.co.jp/event/game/card/entry/' },
  { id: 'aeon', name: 'イオン', kind: 'lottery', url: 'https://aeonretail.com/list/k-chusenhanbai/' },
  { id: 'amiami', name: 'あみあみ', kind: 'lottery', url: 'https://www.amiami.jp/top/page/t/attention.html' },
  { id: 'hareruya2', name: '晴れる屋2', kind: 'lottery', game: 'pokemon', url: 'https://www.hareruya2.com/blogs/news' },
  { id: 'seven-net', name: 'セブンネット', kind: 'lottery', url: 'https://7net.omni7.jp/general/010007/230324pokemoncard' },
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
];
