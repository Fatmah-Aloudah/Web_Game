# Team Quiz Arena — Bilingual v3

A responsive, local-first team quiz game in Arabic and English. The two language banks use independently authored question content within matching category IDs; they are not English-to-Arabic translations of one question list.

## What's included

- **10 matching categories** in both languages.
- **150 questions per category per language**: 1,500 English questions and 1,500 Arabic questions.
- **Up to 6 categories per match**.
- **Exactly 4 completed questions per selected category for each team**. A question counts when the host awards points or selects “No one”; backing out before completion returns it to the deck.
- Add or remove as many teams as needed; active team turns are highlighted in the scoreboard.
- Timer shown above the question on desktop, tablet and mobile.
- Responsive layout, horizontally scrollable team score rail, and a complete final standings list.
- Winner screen with championship banner, podium, confetti and celebration sounds.
- Crossword questions render an actual intersecting blank-cell grid with across/down clues.
- Question decks are shuffled without re-asking a question until a category deck is exhausted.

## Categories

| ID | English | العربية |
|---|---|---|
| `general` | General Knowledge | معلومات عامة |
| `science` | Science | العلوم |
| `history` | History | التاريخ |
| `mixed` | Mixed Challenge | تحدي متنوع |
| `media` | Media Lab | مختبر الوسائط |
| `missing` | Complete the Word | أكمل الكلمة |
| `crossword` | Crossword | كلمات متقاطعة |
| `songs` | Sound & Melody | تحدي الأصوات والألحان |
| `cartoons` | Cartoon Challenge | تحدي الرسوم |
| `noword` | No-Word Pictures | صور بلا كلمات |

## Media included

- **Media Lab:** 50 SVG picture prompts, 50 playable WAV audio prompts, and 50 playable MP4 animated challenges per language.
- **Sound & Melody:** 150 original synthesized melody clips used for different listening questions in each language.
- **Cartoon Challenge / No-Word Pictures:** 150 original illustrated SVG pictogram cards in each category.
- Existing project media files are retained in the `assets/` folder.

**Media limitation:** the newly created picture cards are stylized emoji-based SVG pictograms, not photorealistic photographs or hand-drawn cartoon scenes. The MP4s are original simple shape-animation challenges, not live-action footage. The WAVs are synthesized note patterns, not licensed commercial songs or real-world recordings. Replace or supplement them with your own licensed photographs, cartoon footage, songs or recordings when authentic media is required.

## Run locally

Browsers restrict loading JSON files through `file://`, so use a small local web server.

### Windows

Double-click `scripts/start-windows.bat`, or run in this folder:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

### macOS / Linux

```bash
chmod +x scripts/start.sh
./scripts/start.sh
```

Then open `http://localhost:8000`.

## Database files

- `db/en.json`
- `db/ar.json`

Both have the same category IDs and 150 questions per category. Each question includes an ID, type, question, answer, points and timer. Media questions also include a local asset path. Crossword questions include the grid coordinates and clue data.

## GitHub hosting

The game can load JSON from GitHub Raw URLs and fall back to the local database. Edit `js/config.js`:

```js
window.QUIZ_CONFIG = {
  githubDb: {
    en: "https://raw.githubusercontent.com/YOUR-USER/YOUR-REPO/main/db/en.json",
    ar: "https://raw.githubusercontent.com/YOUR-USER/YOUR-REPO/main/db/ar.json"
  },
  localDb: {
    en: "db/en.json",
    ar: "db/ar.json"
  },
  defaultTimerSeconds: 30
};
```

For static media hosting, upload the `assets/` folder as well as the HTML, CSS, JS and database files. For large media libraries, a CDN or dedicated static-asset host is preferable.

## Editing questions

Edit the relevant JSON category's `questions` array. Supported question `type` values are `text`, `image`, `audio` and `video`. `media` points to the question asset; `answerMedia` optionally adds media to the answer screen.

There is no hard-coded team limit. With 150 questions per category and four questions per selected category per team, 37 teams can receive four unique questions from each category before that category deck must reshuffle; larger matches can still play, but questions may repeat after the 150-question deck is exhausted.
