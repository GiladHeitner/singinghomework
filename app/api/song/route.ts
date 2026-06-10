import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { generateSongOnSpace } from "@/lib/acestep";
import { generateSongOnFal } from "@/lib/fal";
import type { SongResult } from "@/lib/types";

export const maxDuration = 300;

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "song"
  );
}

async function persistAudio(srcUrl: string, title: string): Promise<string> {
  const res = await fetch(srcUrl);
  if (!res.ok) throw new Error(`failed to download generated audio (${res.status})`);
  const audio = await res.arrayBuffer();
  // Local dev without a Blob store: serve the provider URL directly
  // (fine for testing; it expires, so production needs the Blob token).
  if (!process.env.BLOB_READ_WRITE_TOKEN) return srcUrl;
  const blob = await put(`songs/${slugify(title)}-${Date.now()}.mp3`, audio, {
    access: "public",
    contentType: "audio/mpeg",
  });
  return blob.url;
}

export async function POST(request: Request) {
  let body: { lyrics?: unknown; styleTags?: unknown; title?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const lyrics = typeof body.lyrics === "string" ? body.lyrics.trim() : "";
  const styleTags = typeof body.styleTags === "string" ? body.styleTags.trim() : "";
  const title = typeof body.title === "string" ? body.title : "song";

  if (!lyrics || !styleTags) {
    return NextResponse.json(
      { error: "Lyrics and style tags are required." },
      { status: 400 }
    );
  }

  const attempts: Array<{
    provider: SongResult["provider"];
    enabled: boolean;
    run: () => Promise<string>;
  }> = [
    {
      provider: "huggingface",
      enabled: true,
      run: () => generateSongOnSpace(lyrics, styleTags),
    },
    {
      provider: "fal",
      enabled: Boolean(process.env.FAL_KEY),
      run: () => generateSongOnFal(lyrics, styleTags),
    },
  ];

  const errors: string[] = [];
  for (const attempt of attempts) {
    if (!attempt.enabled) continue;
    try {
      const providerUrl = await attempt.run();
      const audioUrl = await persistAudio(providerUrl, title);
      const result: SongResult = { audioUrl, provider: attempt.provider };
      return NextResponse.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`song generation via ${attempt.provider} failed:`, message);
      errors.push(`${attempt.provider}: ${message}`);
    }
  }

  return NextResponse.json(
    {
      error:
        "The band couldn't record right now — the free studio may be busy. Try again in a minute!",
      detail: errors,
    },
    { status: 502 }
  );
}
