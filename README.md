# My English Studio

A personal, adaptive English-learning studio for an Italian speaker at around B1+ who wants to move towards B2 and C1 — by **using** English, not just understanding it.

> Understand less passively. Use more actively.

Everything in the app is in English. Italian appears only as a short note where it explains a typical contrast (false friends, *depend from*, *I am agree*…).

---

## Quick start

```bash
npm install
cp .env.example .env.local     # optional: add ANTHROPIC_API_KEY for the AI tutor
npm run dev                    # http://localhost:3000
```

Requirements: Node.js 20+ (tested on 22). The SQLite database is created automatically at `./data/studio.db` and migrations run on start-up.

Production:

```bash
npm run build && npm start
```

## What works without any API key

| Area | Without AI | With AI configured |
|---|---|---|
| Onboarding, settings, breaks, data export/deletion | ✅ | ✅ |
| Diagnostic (grammar + vocabulary auto-graded) | ✅ writing/speaking samples saved, not assessed | ✅ samples assessed (rough impression) |
| Vocabulary Lab: 17 sets, 12 exercise types, spaced repetition, personal collection | ✅ | ✅ + tutor can check open answers |
| Grammar Lab: 21 lessons, guided + independent practice | ✅ | ✅ + feedback on the communicative task |
| Mistake tracker and targeted practice | ✅ (from exercises) | ✅ (+ from speaking and writing feedback) |
| Speaking Studio: AI role-play conversations (text & voice) | ❌ clearly explained, links to drills | ✅ |
| Speaking Studio: fluency drills (timer, voice transcription, self-review) | ✅ | ✅ + feedback |
| Writing Workshop: drafts, autosave, revisions, draft comparison | ✅ + structured self-review checklist (labelled as such) | ✅ + full feedback |
| Real English: 10 units, challenges, your own resources | ✅ | ✅ + activities built from your resources |
| News | needs `GUARDIAN_API_KEY` (free) | — |
| Daily session planner, recommendations, progress, weekly reflection | ✅ | ✅ |

The app never substitutes canned text for AI output. When the tutor is unavailable the UI says so and offers what does work.

## Configuration

All configuration is via environment variables (see `.env.example`). Secrets are only read on the server.

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Enables the AI tutor (conversations, reports, writing feedback, answer checks, activity building). Paid usage. |
| `AI_MODEL` | Optional. Default `claude-opus-5-5`. |
| `AI_BASE_URL` | Optional override of the API base URL (used by the tests). |
| `GUARDIAN_API_KEY` | Optional. Free developer key from <https://open-platform.theguardian.com/access/> for recent news. |
| `DATABASE_PATH` | SQLite file location. Default `./data/studio.db`. |
| `STUDIO_TIMEZONE` | Default `Europe/Rome`. Used for "today", weeks and streaks. |
| `STUDIO_PASSCODE` | If set, the whole app requires this passcode (HTTP Basic auth, any username). **Set it if you deploy publicly.** |

Settings → *AI tutor*, *Voice* and *News* show the live status of each integration.

## Voice

- **Speech-to-text** uses the browser's Web Speech API: Chrome, Edge and Safari support it; Firefox does not. In Chrome/Edge audio is processed by the browser vendor's online service (Google/Microsoft); in Safari by Apple.
- **Text-to-speech** uses `speechSynthesis` (all modern browsers). The voice and speed are selectable in Settings.
- The app **never records or stores audio**; only the text transcript you send is kept.
- No pronunciation, speech-rate or hesitation scores are shown: the app only receives text, so it doesn't claim to measure them. Speaking statistics are limited to turns, words and time.
- The voice layer (`src/lib/client/speech.ts`) is separate from the conversation logic, so a server-side speech provider could replace it later.

## Architecture

```
src/
  app/                    Next.js App Router pages (server components) + server actions (app/actions)
  components/             UI: design-system primitives (components/ui), exercises, speaking, writing…
  content/                All learning content as typed data: vocabulary sets, grammar lessons,
                          scenarios, writing tasks, Real English units, learning path, diagnostic
  lib/
    domain/               Pure, tested logic: text normalisation, SRS, mistake categorisation and
                          prioritisation, progress metrics, planner, recommendations, level estimate
    exercises/            Exercise types, deterministic grading, vocabulary exercise generation
    ai/                   Provider interface, Anthropic implementation, prompts, Zod schemas,
                          post-validation of AI output
    server/               Data access + services (speaking, writing, feedback, insights, news)
    db/                   Drizzle schema + SQLite client (migrations in /drizzle)
```

Key decisions:

- **Next.js 16 + TypeScript + SQLite (better-sqlite3) via Drizzle.** One process, one file database, no external infrastructure — appropriate for a single-learner app; the schema is keyed so a `learner_id` could be added later.
- **Deterministic grading on the server.** Objective exercises never call an AI. The server re-grades every answer from the exercise id (the client can't fake results). Accepted variants: contractions, curly quotes, punctuation, case, listed alternatives, and genuine one-letter typos — but never a grammatical ending (*announce/announced*).
- **Open answers are never auto-rejected.** If an answer differs from the model but contains the required structure, it is "unverified": the learner compares and decides, or asks the tutor.
- **AI behind an interface** (`src/lib/ai/provider.ts`). Calls use structured outputs validated with Zod, then a second validation step (`validate.ts`) drops corrections that don't quote the learner's actual words, normalises categories and caps list sizes. Errors map to clear, non-technical messages.
- **Spaced repetition** (`lib/domain/srs.ts`): SM-2 family, considering previous performance, successful independent recalls, time since the last review (late successes earn credit), recognition vs recall vs production, and exercise difficulty. Learners can rate Easy / Good / Difficult / Forgotten. Mastered items aren't shown without reason.
- **Mistake tracker** groups repeated instances by pattern, prioritises by frequency, communicative weight, recency and current goals, and marks a mistake resolved only after correct practice on two different days; resolved mistakes are re-checked after three weeks.
- **Explainable recommendations**: rule-based, each with a visible reason derived from data.
- **Active time** is measured only while the tab is visible and the learner has interacted in the last two minutes (capped per activity).

## Tests

```bash
npm run typecheck
npm run lint
npm test            # 109 unit/integration tests (Vitest)
npm run test:e2e    # production build + 18 Playwright tests
npm run check:links # verify external content links (needs normal internet access)
```

Coverage includes grading (alternatives, contractions, typos vs grammar), SRS scheduling, mistake categorisation and prioritisation, progress/streak/week maths, the planner and recommendations, validation schemas, AI output validation, the Anthropic provider (request shape, parsing, error mapping) against a local test double, server flows on an in-memory database (exercises → mistakes, vocabulary reviews, conversations and reports, writing feedback and revisions), **content integrity** (every listed answer grades as correct, every model answer passes its own check, all cross-references exist), and end-to-end flows in a real browser with and without AI.

The AI end-to-end tests use `e2e/mock-anthropic.mjs`, a test double that returns schema-shaped JSON. It verifies the app's request → parse → validate → render path; it cannot verify the quality of real model output.

## Privacy

- Data lives in the local SQLite file. Only text is stored, never audio. The only personal detail requested is an optional first name.
- Settings → *Your data*: download everything as JSON, delete conversation transcripts, delete writing, or reset the studio. You can also choose not to keep conversation transcripts after the report.
- When the AI tutor is enabled, your messages and texts are sent to the AI provider to generate feedback. Check the provider's data-retention terms; don't assume a particular policy.

## Content and copyright

- Literary excerpts are short passages from public-domain works (Austen 1813, Conan Doyle 1891, Jerome 1889) with links to Project Gutenberg.
- Other Real English texts and all exercises were written for this app. Example headlines in the news unit are clearly marked as invented for practice.
- Film, TV and music units don't reproduce scripts or lyrics: the learner chooses legally accessible material.
- News items come from The Guardian Open Platform with attribution, date and link; activities are built only from the article text.

## Known limitations

- The AI features were tested against a local test double, not against the live API: no API key was available in the build environment. Configure a key and try a conversation and a writing task to confirm in your setup.
- External content links (Project Gutenberg, the Guardian, YouTube search) couldn't be fetched from the build sandbox (its network policy blocked those hosts), so they were checked for format only. Run `npm run check:links`.
- The Guardian integration was tested with a parser unit test, not live.
- Voice input depends on browser support (not Firefox) and, in Chrome/Edge, on an internet connection to the browser's speech service. Microphone flows were not testable in the headless test browser.
- Level estimates are informal and conservative: the short diagnostic never suggests C1, and later suggestions require substantial evidence.
- Single learner, no accounts. Use `STUDIO_PASSCODE` (or a proper auth layer) for any public deployment.
- Only the Anthropic provider is implemented; adding another means implementing `AIProvider` in `src/lib/ai`.
