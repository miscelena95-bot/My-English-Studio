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

Requirements: Node.js 20.18+ (tested on 22). Locally the database is a SQLite file created automatically at `./data/studio.db`; migrations run on start-up.

Production on your own server:

```bash
npm run build && npm start
```

## Deploy to Vercel

Vercel has no persistent disk, so the app uses a hosted [Turso](https://turso.tech) (libSQL) database there. It's the same SQLite schema, so nothing else changes.

1. **Create a Turso database** (free tier). With the [Turso CLI](https://docs.turso.tech/cli/introduction):
   ```bash
   turso db create my-english-studio
   turso db show my-english-studio --url      # → DATABASE_URL (libsql://…)
   turso db tokens create my-english-studio   # → DATABASE_AUTH_TOKEN
   ```
   Or create it in the Turso dashboard and copy the URL and a token.
2. **Import the GitHub repository** in Vercel (*Add New → Project*). The framework is detected as Next.js; keep the default build settings. The `vercel-build` script runs the database migrations, then `next build`.
3. **Set environment variables** in *Project → Settings → Environment Variables* (Production, and Preview if you use it):
   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the `libsql://…` URL |
   | `DATABASE_AUTH_TOKEN` | the Turso token |
   | `STUDIO_PASSCODE` | a passcode of your choice — **required** (see below) |
   | `ANTHROPIC_API_KEY` | optional, enables the AI tutor |
   | `GUARDIAN_API_KEY` | optional, enables news |
4. **Deploy.** Open the URL; the browser asks for the passcode (any username).

Safety defaults on Vercel:
- Without `DATABASE_URL` the build fails with a clear message, instead of silently storing data on a disk that disappears.
- Without `STUDIO_PASSCODE` the deployment answers with a "locked" message instead of exposing your learning data and AI credits to anyone with the URL. Set `STUDIO_PUBLIC=1` only if you really want it public.
- AI calls are capped at 2 × 60 s, inside Vercel's default 300 s function limit with Fluid compute (on by default for new projects). If you've turned Fluid compute off on the Hobby plan, AI requests will time out at 10 s — turn it back on.
- Preview deployments share the same database if you give them the same `DATABASE_URL`. Use a separate Turso database for previews if you want to keep your real progress clean.

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
| `HTTPS_PROXY` / `NO_PROXY` | Respected by `npm run check:links` (exit 0 = all OK, 1 = a broken link, 2 = some links unreachable from this network). |
| `GUARDIAN_API_KEY` | Optional. Free developer key from <https://open-platform.theguardian.com/access/> for recent news. |
| `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | Hosted libSQL/Turso database (required on Vercel). Takes precedence over `DATABASE_PATH`. Migrated by `npm run db:migrate` / at build. |
| `DATABASE_PATH` | Local SQLite file. Default `./data/studio.db`. Migrated automatically at start-up. |
| `STUDIO_TIMEZONE` | Default `Europe/Rome`. Used for "today", weeks and streaks. |
| `STUDIO_PASSCODE` | If set, the whole app requires this passcode (HTTP Basic auth, any username). **Required on Vercel.** |
| `STUDIO_PUBLIC` | Set to `1` to deliberately run a Vercel deployment without a passcode. |

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

- **Next.js 16 + TypeScript + SQLite via Drizzle and libSQL.** Locally a single file database with no external infrastructure; in production the same schema on Turso. All data access is async; a type-aware lint rule (`no-floating-promises`) fails the build on any un-awaited query, so writes can't be silently dropped. Child rows are deleted explicitly rather than relying on database cascade settings. The schema is keyed so a `learner_id` could be added later.
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
npm test            # 115 unit/integration tests (Vitest)
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
- The Vercel/Turso setup was verified locally with the same libSQL driver (file and in-memory databases) and a production build, but not against a live Turso database or an actual Vercel deployment — no accounts were available in the build environment. The first deploy is the real test; the build log shows the migration step's result.
- Only the Anthropic provider is implemented; adding another means implementing `AIProvider` in `src/lib/ai`.
