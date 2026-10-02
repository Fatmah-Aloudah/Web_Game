# Team Quiz Arena — Local / GitHub-ready

A static bilingual quiz game for up to 3 teams. The supplied category-screen reference is used as the visual direction for the scoreboard + category grid.

## What is included

- Landing page
- Team setup page: 1–3 teams, Arabic/English names, avatar selection, language
- Category page with all team scores in the header
- Random question from the chosen category
- Start Timer button with configurable per-question seconds
- Answer / reveal page
- Point-claim page with one button per team + “No one” button
- Winner podium: 1st taller than 2nd, 2nd taller than 3rd
- Replay: clears points and used-question history
- English and Arabic JSON databases
- Question/answer support for text plus media types: `image`, `audio`, `video`
- Optional GitHub Raw JSON endpoints in `js/config.js`
- No framework and no build step

## Run locally

Because browsers restrict loading JSON with `file://`, start a small local web server.

### Windows
Double-click `scripts/start-windows.bat`, or run:

```text
python -m http.server 8000
```

Then open `http://localhost:8000`.

### macOS / Linux
Run:

```bash
chmod +x scripts/start.sh
./scripts/start.sh
```

Then open `http://localhost:8000`.

## GitHub database setup

You can keep `db/en.json` and `db/ar.json` in a GitHub repository and have the game fetch them directly.

1. Upload the `db` folder to your GitHub repository.
2. In `js/config.js`, set:

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

The app will try the GitHub URL first and fall back to the local JSON files if the GitHub URL is unavailable.

## Question schema

Each question looks like:

```json
{
  "id": "en-example-1",
  "type": "text",
  "question": "What is 2 + 2?",
  "answer": "4",
  "points": 100,
  "timer": 30
}
```

For media questions, use a media URL or local asset path:

```json
{
  "id": "en-photo-1",
  "type": "image",
  "question": "Identify this landmark.",
  "media": "assets/example.jpg",
  "answer": "Example landmark",
  "answerMedia": "assets/answer.jpg",
  "points": 200,
  "timer": 40
}
```

Supported `type` values: `text`, `image`, `audio`, `video`.

For media answers, use `answerMedia`. For a text answer plus media, keep `answer` and add `answerMedia`.

## Notes about media on GitHub

For large audio/video files, it is better to use a CDN or another static asset host. GitHub is fine for smaller quiz assets, but Git LFS or a dedicated media host may be preferable for a large question library.

## Changing questions

Edit the appropriate JSON file, commit/push the change, and refresh the game. The game does not require a database server.

## Fun & fairness update

- **Shuffled, non-repeating questions**: each category is a shuffled deck; a question is never asked twice until the whole category is used, then it is reshuffled (never starting with the last question). Used questions are remembered across page refreshes; **Same teams, start from zero** and **Back to start (new teams)** both clear them.
- **Team turns**: the category picker rotates between teams; the active team glows in the scoreboard.
- **Fun**: sound effects (mute button 🔊 in the header), confetti, animated timer ring with a shake in the last 5 seconds, flip-in answer reveal, score count-up, and a rising podium. Motion is disabled automatically for users who prefer reduced motion.
- **Test data**: every category has 3–4 questions, plus a *Media Lab* category with an image (with answer image), an audio and a video example in `assets/`.

## Flow update

- **Language** is chosen on the landing page.
- **Category selection page** (after team setup): tick the categories to play; only those appear on the category screen (use *Change categories* to edit later).
- **Ties**: teams with equal scores stand together on the same podium stand.
