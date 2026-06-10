import { Client } from "@gradio/client";

const SPACE_ID = "ACE-Step/Ace-Step-v1.5";

// Signature pinned from `node scripts/introspect-space.mjs` on 2026-06-09.
// /generation_wrapper takes 54 positional args; we override only the ones
// below and pass the Space's defaults for the rest. If the Space changes
// and calls start failing, rerun the introspection script and re-pin.
const ARG_INDEX = {
  prompt: 4, // style tags / caption
  lyrics: 5,
  audioDuration: 15, // seconds, -1 = auto from lyrics
  batchSize: 16,
} as const;

const DEFAULT_ARGS: unknown[] = [
  "acestep-v15-xl-turbo", // selected_model
  "custom", // generation_mode
  null, // simple_query_input
  "unknown", // simple_vocal_language
  null, // [4] Prompt (style tags)
  null, // [5] Lyrics
  0, // BPM (0 = auto)
  "", // Key Signature
  "", // Time Signature
  "unknown", // Vocal Language
  8, // DiT Inference Steps
  7, // guidance scale
  true, // Random Seed
  "-1", // Seed
  null, // Reference Audio
  -1, // [15] Audio Duration (-1 = auto)
  2, // [16] batch size
  null, // Source Audio
  null, // Audio Codes
  0, // Repaint Start
  -1, // Repaint End
  "Fill the audio semantic mask based on the given conditions:",
  1, // audio cover strength
  "text2music", // task type
  false, // use_adg
  0, // cfg_interval_start
  1, // cfg_interval_end
  3, // Shift
  "ode", // Inference Method
  "", // Custom Timesteps
  "mp3", // Audio Format
  0.85, // LM Temperature
  true, // Thinking
  2, // LM CFG Scale
  0, // LM Top-K
  0.9, // LM Top-P
  "NO USER INPUT", // LM Negative Prompt
  true,
  true,
  true,
  null,
  false,
  true,
  false, // Get Scores
  false, // Get LRC
  0.5,
  8,
  null,
  [],
  false,
  null,
  null,
  null,
  null,
];

interface GradioFileData {
  url?: string;
  path?: string;
}

/**
 * Generate a sung song on the free ACE-Step ZeroGPU Space.
 * Returns a URL to the generated audio file (ephemeral — caller must copy it).
 */
export async function generateSongOnSpace(
  lyrics: string,
  styleTags: string,
  durationSec = -1
): Promise<string> {
  const client = await Client.connect(SPACE_ID, {
    token: process.env.HF_TOKEN as `hf_${string}` | undefined,
  });

  const args = [...DEFAULT_ARGS];
  args[ARG_INDEX.prompt] = styleTags;
  args[ARG_INDEX.lyrics] = lyrics;
  args[ARG_INDEX.audioDuration] = durationSec;
  args[ARG_INDEX.batchSize] = 1; // one sample: halves GPU quota spend

  const result = await client.predict("/generation_wrapper", args);
  const outputs = result.data as unknown[];

  const audio = outputs[0] as GradioFileData | null;
  if (!audio?.url) {
    const status = typeof outputs[10] === "string" ? outputs[10] : "no audio returned";
    throw new Error(`ACE-Step Space returned no audio: ${status}`);
  }
  return audio.url;
}
