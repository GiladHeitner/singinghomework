# SingingHomework 🎵

<img src="assets/singinghomework.png" alt="SingingHomework mascot" width="120" align="right" />

Turn the stuff you have to memorize into songs you can't forget.

Paste your homework phrases, pick a vibe, and get a catchy song with real AI vocals singing your phrases — because the chorus you can't get out of your head is the fact you'll remember in the exam.

## How it works

1. **Qwen writes the lyrics** (via OpenRouter's free tier) — your phrases are embedded *verbatim*, repeated in the chorus, structured with `[verse]`/`[chorus]` tags.
2. **ACE-Step v1.5 sings them** — the open-source song model, called for free on its official Hugging Face ZeroGPU Space (with an optional paid fal.ai fallback).
3. **The MP3 is saved to Vercel Blob** so your songs keep playing forever; your song history lives in your browser.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev
```

### Environment variables

| Variable | Required | Where to get it | Cost |
|---|---|---|---|
| `OPENROUTER_API_KEY` | yes | [openrouter.ai/keys](https://openrouter.ai/keys) | Free tier (~50–200 req/day) |
| `HF_TOKEN` | recommended | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) (read token) | Free — ~5 min ZeroGPU/day ≈ dozens of songs |
| `BLOB_READ_WRITE_TOKEN` | for prod | Auto-created when you add a Blob store to the Vercel project | Free (Hobby tier) |
| `FAL_KEY` | optional | [fal.ai](https://fal.ai) — reliable fallback when the free Space is busy | ~$0.02 per song, pay as you go |
| `OPENAI_API_KEY` | optional | Fallback lyricist if OpenRouter is down | your existing credits |

Without `BLOB_READ_WRITE_TOKEN` (local dev), songs play from the provider's temporary URL — fine for testing, but they expire.

## Deploy (Vercel Hobby, free)

1. Push to GitHub and import the repo at [vercel.com/new](https://vercel.com/new).
2. In the project: **Storage → Create Blob store** (injects `BLOB_READ_WRITE_TOKEN`).
3. Add `OPENROUTER_API_KEY` and `HF_TOKEN` under **Settings → Environment Variables**.
4. Deploy. Send the URL to someone who has an exam coming up. 💜

## Maintenance notes

- The ACE-Step Space's gradio signature is pinned in `lib/acestep.ts`. If generation starts failing with weird argument errors, rerun `node scripts/introspect-space.mjs` and re-pin the indices.
- `node scripts/test-song.mts` tests song generation end-to-end without the web UI.
- The feature spec lives at `docs/specs/01-singinghomework.md`.
