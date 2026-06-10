import { fal } from "@fal-ai/client";

interface AceStepOutput {
  audio: { url: string };
}

/**
 * Paid fallback: ACE-Step hosted on fal.ai (~$0.0002/sec of audio).
 * Returns a URL to the generated audio (ephemeral — caller must copy it).
 */
export async function generateSongOnFal(
  lyrics: string,
  styleTags: string,
  durationSec = 90
): Promise<string> {
  fal.config({ credentials: process.env.FAL_KEY });
  const result = await fal.subscribe("fal-ai/ace-step", {
    input: {
      lyrics,
      tags: styleTags,
      duration: durationSec,
    },
  });
  const output = result.data as AceStepOutput;
  if (!output?.audio?.url) {
    throw new Error("fal.ai returned no audio");
  }
  return output.audio.url;
}
