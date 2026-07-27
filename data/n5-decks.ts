// JLPT N5 flashcard data: verbs, adjectives, and nouns.
//
// Each deck carries its own form-label set, since the grammatical forms that
// make sense differ by kind (verbs conjugate on their own; na-adjectives and
// nouns both inflect via the だ/です copula; i-adjectives conjugate directly).

export type Card = {
  en: string
  kanji: string
  kana: string
  romaji: string
  group: string
  /** One [kanji/kana form, romaji] pair per the owning deck's formLabels, in the same order. */
  forms: [string, string][]
}

export type Deck = {
  slug: string
  name: string
  glyph: string
  formLabels: readonly string[]
  cards: Card[]
}

const VERB_FORM_LABELS = [
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

// Adjectives and nouns both inflect via the だ/です copula rather than
// conjugating on their own (i-adjectives are the exception — they conjugate
// directly, without a copula — but are given the same label set here so
// every card in the deck lines up in the same 8 rows).
const ADJECTIVE_FORM_LABELS = [
  'Polite',
  'Polite past',
  'Polite neg.',
  'Plain neg.',
  'Plain past',
  'Plain past neg.',
  'Te-form',
  'Adverbial',
] as const

const NOUN_FORM_LABELS = [
  'Plain',
  'Polite',
  'Polite past',
  'Polite neg.',
  'Plain neg.',
  'Plain past',
  'Plain past neg.',
  'Te-form',
] as const

// --- Godan (u-verb) conjugation shape, for reference while reading the data:
//   -masu / -mashita / -masen / plain neg (-anai) / plain past (euphonic) /
//   te-form (euphonic) / potential (-eru) / volitional (-ou) / progressive (-te iru)

const godanVerbs: Card[] = [
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

const ichidanVerbs: Card[] = [
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

const irregularVerbs: Card[] = [
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

// --- Adjectives -------------------------------------------------------
// i-adjectives conjugate directly (stem + くない/かった/etc.); na-adjectives
// take な only when modifying a noun directly, and otherwise inflect via the
// だ/です copula, same as nouns. 良い (ii/yoi) is the one true irregular:
// the plain-present is read "ii", but every other form uses the "yo-" stem
// (there is no such word as "ikunai" — it's "yokunai"). きれい looks like an
// i-adjective (ends in い) but is grammatically a na-adjective — a classic
// N5 trap, flagged via its group tag below.

const adjectives: Card[] = [
  {
    en: 'big',
    kanji: '大きい', kana: 'おおきい', romaji: 'ookii', group: 'I-adjective',
    forms: [
      ['大きいです', 'ookii desu'], ['大きかったです', 'ookikatta desu'], ['大きくないです', 'ookikunai desu'],
      ['大きくない', 'ookikunai'], ['大きかった', 'ookikatta'], ['大きくなかった', 'ookikunakatta'],
      ['大きくて', 'ookikute'], ['大きく', 'ookiku'],
    ],
  },
  {
    en: 'small',
    kanji: '小さい', kana: 'ちいさい', romaji: 'chiisai', group: 'I-adjective',
    forms: [
      ['小さいです', 'chiisai desu'], ['小さかったです', 'chiisakatta desu'], ['小さくないです', 'chiisakunai desu'],
      ['小さくない', 'chiisakunai'], ['小さかった', 'chiisakatta'], ['小さくなかった', 'chiisakunakatta'],
      ['小さくて', 'chiisakute'], ['小さく', 'chiisaku'],
    ],
  },
  {
    en: 'new',
    kanji: '新しい', kana: 'あたらしい', romaji: 'atarashii', group: 'I-adjective',
    forms: [
      ['新しいです', 'atarashii desu'], ['新しかったです', 'atarashikatta desu'], ['新しくないです', 'atarashikunai desu'],
      ['新しくない', 'atarashikunai'], ['新しかった', 'atarashikatta'], ['新しくなかった', 'atarashikunakatta'],
      ['新しくて', 'atarashikute'], ['新しく', 'atarashiku'],
    ],
  },
  {
    en: 'old (things)',
    kanji: '古い', kana: 'ふるい', romaji: 'furui', group: 'I-adjective',
    forms: [
      ['古いです', 'furui desu'], ['古かったです', 'furukatta desu'], ['古くないです', 'furukunai desu'],
      ['古くない', 'furukunai'], ['古かった', 'furukatta'], ['古くなかった', 'furukunakatta'],
      ['古くて', 'furukute'], ['古く', 'furuku'],
    ],
  },
  {
    en: 'good',
    kanji: '良い', kana: 'いい', romaji: 'ii', group: 'I-adjective · irregular stem',
    forms: [
      ['いいです', 'ii desu'], ['よかったです', 'yokatta desu'], ['よくないです', 'yokunai desu'],
      ['よくない', 'yokunai'], ['よかった', 'yokatta'], ['よくなかった', 'yokunakatta'],
      ['よくて', 'yokute'], ['よく', 'yoku'],
    ],
  },
  {
    en: 'busy',
    kanji: '忙しい', kana: 'いそがしい', romaji: 'isogashii', group: 'I-adjective',
    forms: [
      ['忙しいです', 'isogashii desu'], ['忙しかったです', 'isogashikatta desu'], ['忙しくないです', 'isogashikunai desu'],
      ['忙しくない', 'isogashikunai'], ['忙しかった', 'isogashikatta'], ['忙しくなかった', 'isogashikunakatta'],
      ['忙しくて', 'isogashikute'], ['忙しく', 'isogashiku'],
    ],
  },
  {
    en: 'quiet',
    kanji: '静か', kana: 'しずか', romaji: 'shizuka', group: 'Na-adjective',
    forms: [
      ['静かです', 'shizuka desu'], ['静かでした', 'shizuka deshita'], ['静かじゃないです', 'shizuka janai desu'],
      ['静かじゃない', 'shizuka janai'], ['静かだった', 'shizuka datta'], ['静かじゃなかった', 'shizuka janakatta'],
      ['静かで', 'shizuka de'], ['静かに', 'shizuka ni'],
    ],
  },
  {
    en: 'healthy, energetic, fine',
    kanji: '元気', kana: 'げんき', romaji: 'genki', group: 'Na-adjective',
    forms: [
      ['元気です', 'genki desu'], ['元気でした', 'genki deshita'], ['元気じゃないです', 'genki janai desu'],
      ['元気じゃない', 'genki janai'], ['元気だった', 'genki datta'], ['元気じゃなかった', 'genki janakatta'],
      ['元気で', 'genki de'], ['元気に', 'genki ni'],
    ],
  },
  {
    en: 'pretty, clean',
    kanji: '綺麗', kana: 'きれい', romaji: 'kirei', group: 'Na-adjective · looks i-adjective',
    forms: [
      ['きれいです', 'kirei desu'], ['きれいでした', 'kirei deshita'], ['きれいじゃないです', 'kirei janai desu'],
      ['きれいじゃない', 'kirei janai'], ['きれいだった', 'kirei datta'], ['きれいじゃなかった', 'kirei janakatta'],
      ['きれいで', 'kirei de'], ['きれいに', 'kirei ni'],
    ],
  },
  {
    en: 'to like, fond of',
    kanji: '好き', kana: 'すき', romaji: 'suki', group: 'Na-adjective',
    forms: [
      ['好きです', 'suki desu'], ['好きでした', 'suki deshita'], ['好きじゃないです', 'suki janai desu'],
      ['好きじゃない', 'suki janai'], ['好きだった', 'suki datta'], ['好きじゃなかった', 'suki janakatta'],
      ['好きで', 'suki de'], ['好きに', 'suki ni'],
    ],
  },
]

// --- Nouns --------------------------------------------------------------
// Nouns don't conjugate; what inflects is the だ/です copula attached when
// using the noun as a predicate ("It's a student" / 学生です). Same pattern
// as na-adjectives, minus な and the adverbial form (a noun has no adverbial
// use), plus an explicit plain-だ row.

const nouns: Card[] = [
  {
    en: 'student',
    kanji: '学生', kana: 'がくせい', romaji: 'gakusei', group: 'Person',
    forms: [
      ['学生だ', 'gakusei da'], ['学生です', 'gakusei desu'], ['学生でした', 'gakusei deshita'],
      ['学生じゃないです', 'gakusei janai desu'], ['学生じゃない', 'gakusei janai'], ['学生だった', 'gakusei datta'],
      ['学生じゃなかった', 'gakusei janakatta'], ['学生で', 'gakusei de'],
    ],
  },
  {
    en: 'teacher',
    kanji: '先生', kana: 'せんせい', romaji: 'sensei', group: 'Person',
    forms: [
      ['先生だ', 'sensei da'], ['先生です', 'sensei desu'], ['先生でした', 'sensei deshita'],
      ['先生じゃないです', 'sensei janai desu'], ['先生じゃない', 'sensei janai'], ['先生だった', 'sensei datta'],
      ['先生じゃなかった', 'sensei janakatta'], ['先生で', 'sensei de'],
    ],
  },
  {
    en: 'school',
    kanji: '学校', kana: 'がっこう', romaji: 'gakkou', group: 'Place',
    forms: [
      ['学校だ', 'gakkou da'], ['学校です', 'gakkou desu'], ['学校でした', 'gakkou deshita'],
      ['学校じゃないです', 'gakkou janai desu'], ['学校じゃない', 'gakkou janai'], ['学校だった', 'gakkou datta'],
      ['学校じゃなかった', 'gakkou janakatta'], ['学校で', 'gakkou de'],
    ],
  },
  {
    en: 'company',
    kanji: '会社', kana: 'かいしゃ', romaji: 'kaisha', group: 'Place',
    forms: [
      ['会社だ', 'kaisha da'], ['会社です', 'kaisha desu'], ['会社でした', 'kaisha deshita'],
      ['会社じゃないです', 'kaisha janai desu'], ['会社じゃない', 'kaisha janai'], ['会社だった', 'kaisha datta'],
      ['会社じゃなかった', 'kaisha janakatta'], ['会社で', 'kaisha de'],
    ],
  },
  {
    en: 'house, home',
    kanji: '家', kana: 'いえ', romaji: 'ie', group: 'Place',
    forms: [
      ['家だ', 'ie da'], ['家です', 'ie desu'], ['家でした', 'ie deshita'],
      ['家じゃないです', 'ie janai desu'], ['家じゃない', 'ie janai'], ['家だった', 'ie datta'],
      ['家じゃなかった', 'ie janakatta'], ['家で', 'ie de'],
    ],
  },
  {
    en: 'friend',
    kanji: '友達', kana: 'ともだち', romaji: 'tomodachi', group: 'Person',
    forms: [
      ['友達だ', 'tomodachi da'], ['友達です', 'tomodachi desu'], ['友達でした', 'tomodachi deshita'],
      ['友達じゃないです', 'tomodachi janai desu'], ['友達じゃない', 'tomodachi janai'], ['友達だった', 'tomodachi datta'],
      ['友達じゃなかった', 'tomodachi janakatta'], ['友達で', 'tomodachi de'],
    ],
  },
  {
    en: 'book',
    kanji: '本', kana: 'ほん', romaji: 'hon', group: 'Object',
    forms: [
      ['本だ', 'hon da'], ['本です', 'hon desu'], ['本でした', 'hon deshita'],
      ['本じゃないです', 'hon janai desu'], ['本じゃない', 'hon janai'], ['本だった', 'hon datta'],
      ['本じゃなかった', 'hon janakatta'], ['本で', 'hon de'],
    ],
  },
  {
    en: 'water',
    kanji: '水', kana: 'みず', romaji: 'mizu', group: 'Food & drink',
    forms: [
      ['水だ', 'mizu da'], ['水です', 'mizu desu'], ['水でした', 'mizu deshita'],
      ['水じゃないです', 'mizu janai desu'], ['水じゃない', 'mizu janai'], ['水だった', 'mizu datta'],
      ['水じゃなかった', 'mizu janakatta'], ['水で', 'mizu de'],
    ],
  },
  {
    en: 'cat',
    kanji: '猫', kana: 'ねこ', romaji: 'neko', group: 'Animal',
    forms: [
      ['猫だ', 'neko da'], ['猫です', 'neko desu'], ['猫でした', 'neko deshita'],
      ['猫じゃないです', 'neko janai desu'], ['猫じゃない', 'neko janai'], ['猫だった', 'neko datta'],
      ['猫じゃなかった', 'neko janakatta'], ['猫で', 'neko de'],
    ],
  },
  {
    en: 'car',
    kanji: '車', kana: 'くるま', romaji: 'kuruma', group: 'Object',
    forms: [
      ['車だ', 'kuruma da'], ['車です', 'kuruma desu'], ['車でした', 'kuruma deshita'],
      ['車じゃないです', 'kuruma janai desu'], ['車じゃない', 'kuruma janai'], ['車だった', 'kuruma datta'],
      ['車じゃなかった', 'kuruma janakatta'], ['車で', 'kuruma de'],
    ],
  },
]

export const DECKS: Deck[] = [
  { slug: 'verbs', name: 'Verbs', glyph: '動', formLabels: VERB_FORM_LABELS, cards: [...godanVerbs, ...ichidanVerbs, ...irregularVerbs] },
  { slug: 'adjectives', name: 'Adjectives', glyph: '形', formLabels: ADJECTIVE_FORM_LABELS, cards: adjectives },
  { slug: 'nouns', name: 'Nouns', glyph: '名', formLabels: NOUN_FORM_LABELS, cards: nouns },
]
