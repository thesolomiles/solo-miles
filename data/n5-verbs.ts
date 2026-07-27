// JLPT N5 verb data for the flashcards study tool.
//
// Each verb carries its 9 key inflected forms, in this fixed order:
export const FORM_LABELS = [
  'Polite',
  'Polite past',
  'Polite neg.',
  'Plain neg.',
  'Plain past',
  'Te-form',
  'Potential',
  'Volitional',
  'Progressive',
] as const

export type VerbGroup = 'Godan' | 'Ichidan' | 'Irregular'

export type Verb = {
  en: string
  kanji: string
  kana: string
  romaji: string
  group: string
  /** One [kanji/kana form, romaji] pair per FORM_LABELS entry, in the same order. */
  forms: [string, string][]
}

export type Deck = {
  slug: string
  name: string
  glyph: string
  group: VerbGroup
  verbs: Verb[]
}

// --- Godan (u-verb) conjugation shape, for reference while reading the data:
//   -masu / -mashita / -masen / plain neg (-anai) / plain past (euphonic) /
//   te-form (euphonic) / potential (-eru) / volitional (-ou) / progressive (-te iru)

const godanVerbs: Verb[] = [
  {
    en: 'to drink',
    kanji: '飲む', kana: 'のむ', romaji: 'nomu', group: 'Godan',
    forms: [
      ['飲みます', 'nomimasu'], ['飲みました', 'nomimashita'], ['飲みません', 'nomimasen'],
      ['飲まない', 'nomanai'], ['飲んだ', 'nonda'], ['飲んで', 'nonde'],
      ['飲める', 'nomeru'], ['飲もう', 'nomou'], ['飲んでいる', 'nonde iru'],
    ],
  },
  {
    en: 'to go',
    kanji: '行く', kana: 'いく', romaji: 'iku', group: 'Godan · irregular te/past',
    forms: [
      ['行きます', 'ikimasu'], ['行きました', 'ikimashita'], ['行きません', 'ikimasen'],
      ['行かない', 'ikanai'], ['行った', 'itta'], ['行って', 'itte'],
      ['行ける', 'ikeru'], ['行こう', 'ikou'], ['行っている', 'itte iru'],
    ],
  },
  {
    en: 'to buy',
    kanji: '買う', kana: 'かう', romaji: 'kau', group: 'Godan',
    forms: [
      ['買います', 'kaimasu'], ['買いました', 'kaimashita'], ['買いません', 'kaimasen'],
      ['買わない', 'kawanai'], ['買った', 'katta'], ['買って', 'katte'],
      ['買える', 'kaeru'], ['買おう', 'kaou'], ['買っている', 'katte iru'],
    ],
  },
  {
    en: 'to read',
    kanji: '読む', kana: 'よむ', romaji: 'yomu', group: 'Godan',
    forms: [
      ['読みます', 'yomimasu'], ['読みました', 'yomimashita'], ['読みません', 'yomimasen'],
      ['読まない', 'yomanai'], ['読んだ', 'yonda'], ['読んで', 'yonde'],
      ['読める', 'yomeru'], ['読もう', 'yomou'], ['読んでいる', 'yonde iru'],
    ],
  },
  {
    en: 'to write',
    kanji: '書く', kana: 'かく', romaji: 'kaku', group: 'Godan',
    forms: [
      ['書きます', 'kakimasu'], ['書きました', 'kakimashita'], ['書きません', 'kakimasen'],
      ['書かない', 'kakanai'], ['書いた', 'kaita'], ['書いて', 'kaite'],
      ['書ける', 'kakeru'], ['書こう', 'kakou'], ['書いている', 'kaite iru'],
    ],
  },
  {
    en: 'to speak',
    kanji: '話す', kana: 'はなす', romaji: 'hanasu', group: 'Godan',
    forms: [
      ['話します', 'hanashimasu'], ['話しました', 'hanashimashita'], ['話しません', 'hanashimasen'],
      ['話さない', 'hanasanai'], ['話した', 'hanashita'], ['話して', 'hanashite'],
      ['話せる', 'hanaseru'], ['話そう', 'hanasou'], ['話している', 'hanashite iru'],
    ],
  },
  {
    en: 'to listen, to ask',
    kanji: '聞く', kana: 'きく', romaji: 'kiku', group: 'Godan',
    forms: [
      ['聞きます', 'kikimasu'], ['聞きました', 'kikimashita'], ['聞きません', 'kikimasen'],
      ['聞かない', 'kikanai'], ['聞いた', 'kiita'], ['聞いて', 'kiite'],
      ['聞ける', 'kikeru'], ['聞こう', 'kikou'], ['聞いている', 'kiite iru'],
    ],
  },
  {
    en: 'to wait',
    kanji: '待つ', kana: 'まつ', romaji: 'matsu', group: 'Godan',
    forms: [
      ['待ちます', 'machimasu'], ['待ちました', 'machimashita'], ['待ちません', 'machimasen'],
      ['待たない', 'matanai'], ['待った', 'matta'], ['待って', 'matte'],
      ['待てる', 'materu'], ['待とう', 'matou'], ['待っている', 'matte iru'],
    ],
  },
  {
    en: 'to return home',
    kanji: '帰る', kana: 'かえる', romaji: 'kaeru', group: 'Godan · looks ichidan',
    forms: [
      ['帰ります', 'kaerimasu'], ['帰りました', 'kaerimashita'], ['帰りません', 'kaerimasen'],
      ['帰らない', 'kaeranai'], ['帰った', 'kaetta'], ['帰って', 'kaette'],
      ['帰れる', 'kaereru'], ['帰ろう', 'kaerou'], ['帰っている', 'kaette iru'],
    ],
  },
  {
    en: 'to swim',
    kanji: '泳ぐ', kana: 'およぐ', romaji: 'oyogu', group: 'Godan',
    forms: [
      ['泳ぎます', 'oyogimasu'], ['泳ぎました', 'oyogimashita'], ['泳ぎません', 'oyogimasen'],
      ['泳がない', 'oyoganai'], ['泳いだ', 'oyoida'], ['泳いで', 'oyoide'],
      ['泳げる', 'oyogeru'], ['泳ごう', 'oyogou'], ['泳いでいる', 'oyoide iru'],
    ],
  },
  {
    en: 'to play, to hang out',
    kanji: '遊ぶ', kana: 'あそぶ', romaji: 'asobu', group: 'Godan',
    forms: [
      ['遊びます', 'asobimasu'], ['遊びました', 'asobimashita'], ['遊びません', 'asobimasen'],
      ['遊ばない', 'asobanai'], ['遊んだ', 'asonda'], ['遊んで', 'asonde'],
      ['遊べる', 'asoberu'], ['遊ぼう', 'asobou'], ['遊んでいる', 'asonde iru'],
    ],
  },
  {
    en: 'to use',
    kanji: '使う', kana: 'つかう', romaji: 'tsukau', group: 'Godan',
    forms: [
      ['使います', 'tsukaimasu'], ['使いました', 'tsukaimashita'], ['使いません', 'tsukaimasen'],
      ['使わない', 'tsukawanai'], ['使った', 'tsukatta'], ['使って', 'tsukatte'],
      ['使える', 'tsukaeru'], ['使おう', 'tsukaou'], ['使っている', 'tsukatte iru'],
    ],
  },
]

const ichidanVerbs: Verb[] = [
  {
    en: 'to eat',
    kanji: '食べる', kana: 'たべる', romaji: 'taberu', group: 'Ichidan',
    forms: [
      ['食べます', 'tabemasu'], ['食べました', 'tabemashita'], ['食べません', 'tabemasen'],
      ['食べない', 'tabenai'], ['食べた', 'tabeta'], ['食べて', 'tabete'],
      ['食べられる', 'taberareru'], ['食べよう', 'tabeyou'], ['食べている', 'tabete iru'],
    ],
  },
  {
    en: 'to see, to watch',
    kanji: '見る', kana: 'みる', romaji: 'miru', group: 'Ichidan',
    forms: [
      ['見ます', 'mimasu'], ['見ました', 'mimashita'], ['見ません', 'mimasen'],
      ['見ない', 'minai'], ['見た', 'mita'], ['見て', 'mite'],
      ['見られる', 'mirareru'], ['見よう', 'miyou'], ['見ている', 'mite iru'],
    ],
  },
  {
    en: 'to wake up, to get up',
    kanji: '起きる', kana: 'おきる', romaji: 'okiru', group: 'Ichidan',
    forms: [
      ['起きます', 'okimasu'], ['起きました', 'okimashita'], ['起きません', 'okimasen'],
      ['起きない', 'okinai'], ['起きた', 'okita'], ['起きて', 'okite'],
      ['起きられる', 'okirareru'], ['起きよう', 'okiyou'], ['起きている', 'okite iru'],
    ],
  },
  {
    en: 'to sleep, to go to bed',
    kanji: '寝る', kana: 'ねる', romaji: 'neru', group: 'Ichidan',
    forms: [
      ['寝ます', 'nemasu'], ['寝ました', 'nemashita'], ['寝ません', 'nemasen'],
      ['寝ない', 'nenai'], ['寝た', 'neta'], ['寝て', 'nete'],
      ['寝られる', 'nerareru'], ['寝よう', 'neyou'], ['寝ている', 'nete iru'],
    ],
  },
  {
    en: 'to exit, to leave',
    kanji: '出る', kana: 'でる', romaji: 'deru', group: 'Ichidan',
    forms: [
      ['出ます', 'demasu'], ['出ました', 'demashita'], ['出ません', 'demasen'],
      ['出ない', 'denai'], ['出た', 'deta'], ['出て', 'dete'],
      ['出られる', 'derareru'], ['出よう', 'deyou'], ['出ている', 'dete iru'],
    ],
  },
  {
    en: 'to teach, to tell',
    kanji: '教える', kana: 'おしえる', romaji: 'oshieru', group: 'Ichidan',
    forms: [
      ['教えます', 'oshiemasu'], ['教えました', 'oshiemashita'], ['教えません', 'oshiemasen'],
      ['教えない', 'oshienai'], ['教えた', 'oshieta'], ['教えて', 'oshiete'],
      ['教えられる', 'oshierareru'], ['教えよう', 'oshieyou'], ['教えている', 'oshiete iru'],
    ],
  },
  {
    en: 'to remember, to memorize',
    kanji: '覚える', kana: 'おぼえる', romaji: 'oboeru', group: 'Ichidan',
    forms: [
      ['覚えます', 'oboemasu'], ['覚えました', 'oboemashita'], ['覚えません', 'oboemasen'],
      ['覚えない', 'oboenai'], ['覚えた', 'oboeta'], ['覚えて', 'oboete'],
      ['覚えられる', 'oboerareru'], ['覚えよう', 'oboeyou'], ['覚えている', 'oboete iru'],
    ],
  },
  {
    en: 'to forget',
    kanji: '忘れる', kana: 'わすれる', romaji: 'wasureru', group: 'Ichidan',
    forms: [
      ['忘れます', 'wasuremasu'], ['忘れました', 'wasuremashita'], ['忘れません', 'wasuremasen'],
      ['忘れない', 'wasurenai'], ['忘れた', 'wasureta'], ['忘れて', 'wasurete'],
      ['忘れられる', 'wasurerareru'], ['忘れよう', 'wasureyou'], ['忘れている', 'wasurete iru'],
    ],
  },
  {
    en: 'to borrow',
    kanji: '借りる', kana: 'かりる', romaji: 'kariru', group: 'Ichidan',
    forms: [
      ['借ります', 'karimasu'], ['借りました', 'karimashita'], ['借りません', 'karimasen'],
      ['借りない', 'karinai'], ['借りた', 'karita'], ['借りて', 'karite'],
      ['借りられる', 'karirareru'], ['借りよう', 'kariyou'], ['借りている', 'karite iru'],
    ],
  },
  {
    en: 'to open (something)',
    kanji: '開ける', kana: 'あける', romaji: 'akeru', group: 'Ichidan',
    forms: [
      ['開けます', 'akemasu'], ['開けました', 'akemashita'], ['開けません', 'akemasen'],
      ['開けない', 'akenai'], ['開けた', 'aketa'], ['開けて', 'akete'],
      ['開けられる', 'akerareru'], ['開けよう', 'akeyou'], ['開けている', 'akete iru'],
    ],
  },
]

const irregularVerbs: Verb[] = [
  {
    en: 'to do',
    kanji: 'する', kana: 'する', romaji: 'suru', group: 'Irregular',
    forms: [
      ['します', 'shimasu'], ['しました', 'shimashita'], ['しません', 'shimasen'],
      ['しない', 'shinai'], ['した', 'shita'], ['して', 'shite'],
      ['できる', 'dekiru'], ['しよう', 'shiyou'], ['している', 'shite iru'],
    ],
  },
  {
    en: 'to come',
    kanji: '来る', kana: 'くる', romaji: 'kuru', group: 'Irregular',
    forms: [
      ['来ます', 'kimasu'], ['来ました', 'kimashita'], ['来ません', 'kimasen'],
      ['来ない', 'konai'], ['来た', 'kita'], ['来て', 'kite'],
      ['来られる', 'korareru'], ['来よう', 'koyou'], ['来ている', 'kite iru'],
    ],
  },
  {
    en: 'to study',
    kanji: '勉強する', kana: 'べんきょうする', romaji: 'benkyou suru', group: 'Irregular · suru-verb',
    forms: [
      ['勉強します', 'benkyou shimasu'], ['勉強しました', 'benkyou shimashita'], ['勉強しません', 'benkyou shimasen'],
      ['勉強しない', 'benkyou shinai'], ['勉強した', 'benkyou shita'], ['勉強して', 'benkyou shite'],
      ['勉強できる', 'benkyou dekiru'], ['勉強しよう', 'benkyou shiyou'], ['勉強している', 'benkyou shite iru'],
    ],
  },
  {
    en: 'to make a phone call',
    kanji: '電話する', kana: 'でんわする', romaji: 'denwa suru', group: 'Irregular · suru-verb',
    forms: [
      ['電話します', 'denwa shimasu'], ['電話しました', 'denwa shimashita'], ['電話しません', 'denwa shimasen'],
      ['電話しない', 'denwa shinai'], ['電話した', 'denwa shita'], ['電話して', 'denwa shite'],
      ['電話できる', 'denwa dekiru'], ['電話しよう', 'denwa shiyou'], ['電話している', 'denwa shite iru'],
    ],
  },
  {
    en: 'to go shopping',
    kanji: '買い物する', kana: 'かいものする', romaji: 'kaimono suru', group: 'Irregular · suru-verb',
    forms: [
      ['買い物します', 'kaimono shimasu'], ['買い物しました', 'kaimono shimashita'], ['買い物しません', 'kaimono shimasen'],
      ['買い物しない', 'kaimono shinai'], ['買い物した', 'kaimono shita'], ['買い物して', 'kaimono shite'],
      ['買い物できる', 'kaimono dekiru'], ['買い物しよう', 'kaimono shiyou'], ['買い物している', 'kaimono shite iru'],
    ],
  },
]

export const DECKS: Deck[] = [
  { slug: 'godan', name: 'Godan verbs', glyph: '動', group: 'Godan', verbs: godanVerbs },
  { slug: 'ichidan', name: 'Ichidan verbs', glyph: '動', group: 'Ichidan', verbs: ichidanVerbs },
  { slug: 'irregular', name: 'Irregular verbs', glyph: '動', group: 'Irregular', verbs: irregularVerbs },
]
