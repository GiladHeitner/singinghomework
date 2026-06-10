# Feature Spec: SingingHomework — AI-sung songs from homework phrases

**Date:** 2026-06-09
**Status:** In Progress

---

## Goal and Scope

### Goal
A single-screen web app where a student pastes phrases she must memorize, picks a vibe, and gets back a catchy song with real AI vocals singing those phrases verbatim. Repetition through music as a memorization tool. Single user, free to operate, delight over features.

### In Scope
- Next.js app (App Router, TS, Tailwind) deployed on Vercel Hobby.
- Lyrics generation with Qwen (OpenRouter free tier), embedding homework phrases verbatim.
- Sung-audio generation with ACE-Step v1.5 via its free Hugging Face ZeroGPU Space, with fal.ai paid fallback.
- Audio persistence in Vercel Blob; song history in browser localStorage.

### Out of Scope
- Auth/accounts, multi-user support, databases.
- Self-hosting the music model.
- Mobile apps; the responsive web page is the product.

---

## Context

### Background
Suno/ElevenLabs-quality song APIs are paid. ACE-Step v1.5 (open-source, quality between Suno v4.5–v5, seconds-fast on GPU) is callable free through its official HF ZeroGPU Space (~300s GPU/day on a free HF account ≈ dozens of songs). Qwen is the user's preferred LLM and has a $0 OpenRouter tier.

### Current State
Greenfield repo: fresh create-next-app scaffold, no app code yet. GitHub: GiladHeitner/singinghomework.

### Context
- [plan file](../../README.md): repo README (to be written) carries setup/env instructions.
- [scripts/introspect-space.mjs](../../scripts/introspect-space.mjs): dumps the ACE-Step Space gradio signature; rerun if the Space breaks.

### Constraints
- $0 recurring cost target; only optional one-time fal.ai credit (~$5 ≈ 200+ songs).
- Vercel Hobby: function `maxDuration` up to 300s with Fluid Compute — synchronous generation is acceptable; no queue infra.
- HF Space signature can change without notice; provider URLs (gradio files, fal) are ephemeral, so audio must be copied to Vercel Blob.

### Non-obvious Dependencies or Access
- `HF_TOKEN` (free HF account) raises ZeroGPU quota and queue priority.
- `OPENROUTER_API_KEY` free tier: ~50–200 req/day unfunded — plenty for one user.

---

## Approach and Touchpoints

### Proposed Approach
Two sequential API routes so lyrics show fast while audio renders:
1. `POST /api/lyrics`: Qwen turns phrases + genre into `{ title, lyrics, styleTags }` — phrases verbatim (chorus-preferred), ACE-Step structure tags (`[verse]/[chorus]/[bridge]`), strict JSON, server-side verbatim validation with one corrective retry.
2. `POST /api/song`: ACE-Step HF Space via `@gradio/client` → on failure, fal.ai `fal-ai/ace-step` if `FAL_KEY` set → friendly error. Resulting audio uploaded to Vercel Blob (`songs/{slug}-{ts}.mp3`), public URL returned.
Client keeps history (`localStorage`) of `{ title, genre, lyrics, phrases, audioUrl, createdAt }`.

### Integration Points / Touchpoints
- `lib/lyrics.ts` — OpenRouter/Qwen client + prompt contract + validation.
- `lib/acestep.ts` — pinned gradio endpoint signature for the Space (introspected, see scripts/).
- `lib/fal.ts` — fal fallback client.
- `app/api/lyrics/route.ts`, `app/api/song/route.ts` (`maxDuration = 300`).
- `app/page.tsx` — the single screen.

### Resolved Ambiguities / Decisions
- Sung vocals required (not synth melody + karaoke): user decision.
- Qwen for lyrics via OpenRouter `:free` model (durable) over DashScope free quota (expires after 90 days).
- No auth: single user, unguessable URL is acceptable; revisit only if abused.
- Synchronous generation with staged loading copy instead of job queue: Hobby 300s ceiling covers ACE-Step's seconds-fast generation plus queue waits.

---

## Acceptance Criteria

- [ ] Entering phrases and a genre produces a playable song whose vocals sing every phrase verbatim.
- [ ] Lyrics appear within a few seconds, before audio finishes rendering; homework phrases are visually highlighted in the lyric view.
- [ ] Generated audio URLs keep playing after server restarts/redeploys (Blob persistence).
- [ ] When the HF Space is down/queued out, the fal fallback (if configured) produces the song; otherwise the user sees a friendly retry message, never a stack trace.
- [ ] Past songs replay from history after a page reload.

---

## Phases and Dependencies

### Phase 1: Scaffold + de-risk
- [x] create-next-app scaffold, deps installed (`@gradio/client`, `@fal-ai/client`, `@vercel/blob`, `openai`).
- [x] Introspect ACE-Step Space signature; pin in `lib/acestep.ts` (`/generation_wrapper`, 54 positional args; overrides at indices 4/5/15/16).

### Phase 2: Generation pipeline
- [x] `lib/lyrics.ts` + `/api/lyrics` with verbatim validation + retry.
- [x] `lib/acestep.ts`, `lib/fal.ts`, `/api/song` with fallback chain + Blob upload.

### Phase 3: UI + polish
- [x] `app/page.tsx`: textarea, genre chips, staged loading, player, marked lyrics, history.
- [x] Mascot as favicon/header (hand-drawn chibi SVG; icon-gen's imagegen dependency unavailable, inline-icon script used for assets).

### Phase 4: Verify + deploy
- [ ] End-to-end real song locally; fallback path exercised.
- [ ] Push to GitHub; Vercel project + Blob store + env vars; production song from a phone.

### Phase Dependencies
- Phase 2 depends on Phase 1's pinned Space signature. Phase 4 last; Phase 3 can interleave with Phase 2.

---

## Validation Plan

Manual validation:
- Generate with "mitochondria is the powerhouse of the cell" (+1 more phrase); listen: vocals sing both phrases; lyric view marks them.
- Restart dev server; previously generated Blob URL still plays.
- Unset `HF_TOKEN`/break Space URL: fal path used when `FAL_KEY` present; friendly error when absent.
- Malformed Qwen output (force with absurd phrase): retry path triggers, request still succeeds or fails friendly.
- Production: generate from a phone; reload; history replays.

---

## Done Criteria

- [ ] Implementation complete and acceptance criteria verified manually.
- [ ] README documents env vars, free-tier quotas, and Vercel deploy steps.
- [ ] Spec updated and archived to `docs/specs/.archive/` on completion.

---

## Open Items and Risks

### Open Items
- [x] Confirm actual ACE-Step Space endpoint signature (pinned in `lib/acestep.ts`).
- [ ] User must create HF + OpenRouter keys before deploy.
- [ ] Final listen-test blocked on keys: anonymous Space call validated the request shape (failed only on quota: "180s requested vs 0s left — authenticate for more"). Each generation reserves a 180s ZeroGPU slice → free quota ≈ a few songs/day; `FAL_KEY` recommended as overflow.

### Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
| --- | --- | --- | --- |
| HF Space changes gradio signature or goes down | High | Med | Signature pinned in one file + introspection script to re-pin; fal fallback one env var away |
| Peak-time ZeroGPU queues feel slow | Med | Med | Staged loading copy; fal fallback; quota resets daily |
| Qwen omits a phrase or breaks JSON | Med | Low | Server-side verbatim validation + one corrective retry; OpenAI fallback model |
| Vercel Blob free cap (5GB) fills | Low | Low | ~1,500 songs of headroom; history delete also deletes blob (nice-to-have) |

### Simplifications and Assumptions
- Single user → no auth, no DB, localStorage history is authoritative.
- English-first lyrics; ACE-Step supports 50+ languages if she studies languages later.

---

## Outputs

- PR created from this spec: direct commits to `main` (single-user hobby project, no PR flow).

## Manual Notes 

[keep this for the user to add notes. do not change between edits]

## Changelog
- [2026-06-09 23:47]: Initial spec created from approved plan (session b4c14612-3d12-41a7-a849-8c59a12d1f0e)
- [2026-06-10 00:10]: Phases 1–3 implemented; Space signature pinned; verification in progress (session b4c14612-3d12-41a7-a849-8c59a12d1f0e)
