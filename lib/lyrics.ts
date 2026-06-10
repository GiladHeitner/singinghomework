import OpenAI from "openai";
import type { Genre, LyricsResult } from "./types";

const QWEN_MODEL = "qwen/qwen3-next-80b-a3b-instruct:free";
const OPENAI_FALLBACK_MODEL = "gpt-4o-mini";

const GENRE_STYLE_HINTS: Record<Genre, string> = {
  Pop: "pop, catchy, upbeat, female vocals, polished production, radio-ready",
  "K-Pop": "k-pop, energetic, bright synths, female vocals, catchy hook, dance",
  Rock: "rock, electric guitar, driving drums, powerful vocals, anthemic",
  Rap: "hip hop, rap, strong beat, rhythmic flow, confident vocals, 90 bpm",
  Country: "country, acoustic guitar, warm vocals, storytelling, twangy",
  Lullaby: "lullaby, soft, gentle female vocals, slow tempo, soothing, music box",
  EDM: "edm, electronic dance, big drop, festival, euphoric, four on the floor",
  Showtune: "musical theater, broadway, showtune, dramatic vocals, piano, brass",
};

function buildSystemPrompt(genre: Genre): string {
  return `You are a hit songwriter who writes short, extremely catchy study songs that help a student memorize facts.

You will be given a list of HOMEWORK PHRASES the student must memorize, plus a genre.

Rules — every single one matters:
1. Every homework phrase MUST appear in the lyrics VERBATIM, character for character (you may change surrounding words, never the phrase itself). Put the most important phrases in the chorus so they repeat.
2. Repetition is the point: the chorus should appear at least twice and carry the key phrases.
3. Structure the lyrics with these tags on their own lines: [verse], [chorus], and optionally [bridge]. No other tags.
4. Keep total lyric material around 60–120 seconds of singing (roughly 12–24 short lines).
5. Lines should be short, rhythmic, and singable. Rhyme where natural, never at the cost of rule 1.
6. The genre is "${genre}". Write lyrics that fit it.
7. Also produce a comma-separated list of music style tags describing the track (genre, mood, voice, instrumentation, tempo). Base it on: ${GENRE_STYLE_HINTS[genre]}. Adjust mood to fit the subject matter.

Respond with ONLY a JSON object, no markdown fences, in exactly this shape:
{"title": "song title", "lyrics": "[verse]\\nline\\n...", "styleTags": "tag1, tag2, ..."}`;
}

function buildUserPrompt(phrases: string[]): string {
  return `Homework phrases to memorize (each must appear verbatim in the lyrics):\n${phrases
    .map((p) => `- ${p}`)
    .join("\n")}`;
}

function parseLyricsJson(raw: string): LyricsResult | null {
  // Models sometimes wrap JSON in fences or prose despite instructions.
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (
      typeof parsed.title === "string" &&
      typeof parsed.lyrics === "string" &&
      typeof parsed.styleTags === "string"
    ) {
      return parsed as LyricsResult;
    }
  } catch {
    // fall through
  }
  return null;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function missingPhrases(lyrics: string, phrases: string[]): string[] {
  const haystack = normalize(lyrics);
  return phrases.filter((p) => !haystack.includes(normalize(p)));
}

interface LlmClient {
  client: OpenAI;
  model: string;
}

function getClients(): LlmClient[] {
  const clients: LlmClient[] = [];
  if (process.env.OPENROUTER_API_KEY) {
    clients.push({
      client: new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
      }),
      model: QWEN_MODEL,
    });
  }
  if (process.env.OPENAI_API_KEY) {
    clients.push({
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      model: OPENAI_FALLBACK_MODEL,
    });
  }
  return clients;
}

async function askOnce(
  { client, model }: LlmClient,
  genre: Genre,
  phrases: string[],
  correction?: string
): Promise<LyricsResult | null> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(genre) },
    { role: "user", content: buildUserPrompt(phrases) },
  ];
  if (correction) {
    messages.push({ role: "user", content: correction });
  }
  const completion = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.9,
  });
  const raw = completion.choices[0]?.message?.content ?? "";
  return parseLyricsJson(raw);
}

/**
 * Generate lyrics embedding every phrase verbatim. Tries Qwen (OpenRouter)
 * first, then OpenAI if configured. Each provider gets one corrective retry
 * when a phrase is missing or the JSON is malformed.
 */
export async function generateLyrics(
  phrases: string[],
  genre: Genre
): Promise<LyricsResult> {
  const clients = getClients();
  if (clients.length === 0) {
    throw new Error(
      "No lyrics provider configured: set OPENROUTER_API_KEY (or OPENAI_API_KEY)."
    );
  }

  let lastError = "lyrics generation failed";
  for (const llm of clients) {
    try {
      let result = await askOnce(llm, genre, phrases);
      let missing = result ? missingPhrases(result.lyrics, phrases) : phrases;
      if (result && missing.length === 0) return result;

      const correction = result
        ? `These phrases are missing from the lyrics and MUST appear verbatim: ${missing
            .map((p) => `"${p}"`)
            .join(", ")}. Rewrite the full JSON with every phrase included verbatim.`
        : "Your previous reply was not valid JSON. Respond with ONLY the JSON object described in the instructions.";
      result = await askOnce(llm, genre, phrases, correction);
      missing = result ? missingPhrases(result.lyrics, phrases) : phrases;
      if (result && missing.length === 0) return result;

      // Imperfect but usable beats a hard failure: accept a result that
      // parsed but dropped a phrase only after both attempts on the last provider.
      if (result && llm === clients[clients.length - 1]) return result;
      lastError = `lyrics kept missing phrases: ${missing.join(", ")}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(lastError);
}
