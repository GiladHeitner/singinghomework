// End-to-end test of the ACE-Step Space integration without the web app.
// Usage: HF_TOKEN=hf_xxx node scripts/test-song.mts
import { generateSongOnSpace } from "../lib/acestep.ts";

const lyrics = `[chorus]
Mitochondria is the powerhouse of the cell
Sing it loud, sing it well
Mitochondria is the powerhouse of the cell
That's the fact, ring the bell`;

const tags = "pop, catchy, upbeat, female vocals, clean production";

console.log("Generating (this uses seconds of ZeroGPU quota)...");
const start = Date.now();
const url = await generateSongOnSpace(lyrics, tags, 30);
console.log(`OK in ${((Date.now() - start) / 1000).toFixed(1)}s`);
console.log("Audio URL:", url);
