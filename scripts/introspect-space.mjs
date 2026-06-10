// Throwaway: dump the ACE-Step Space's gradio API so we can pin the
// endpoint name + argument order in lib/acestep.ts.
// Usage: HF_TOKEN=hf_xxx node scripts/introspect-space.mjs [space-id]
import { Client } from "@gradio/client";

const space = process.argv[2] ?? "ACE-Step/Ace-Step-v1.5";
const opts = process.env.HF_TOKEN ? { token: process.env.HF_TOKEN } : {};

const client = await Client.connect(space, opts);
const api = await client.view_api();
console.log(JSON.stringify(api, null, 2));
