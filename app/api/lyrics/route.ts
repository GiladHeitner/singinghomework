import { NextResponse } from "next/server";
import { generateLyrics } from "@/lib/lyrics";
import { GENRES, type Genre } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { phrases?: unknown; genre?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const phrases = Array.isArray(body.phrases)
    ? body.phrases.filter((p): p is string => typeof p === "string" && p.trim() !== "").map((p) => p.trim())
    : [];
  const genre = GENRES.includes(body.genre as Genre) ? (body.genre as Genre) : null;

  if (phrases.length === 0) {
    return NextResponse.json(
      { error: "Add at least one phrase to memorize." },
      { status: 400 }
    );
  }
  if (phrases.length > 10) {
    return NextResponse.json(
      { error: "Keep it to 10 phrases per song — shorter songs stick better!" },
      { status: 400 }
    );
  }
  if (!genre) {
    return NextResponse.json({ error: "Pick a genre." }, { status: 400 });
  }

  try {
    const lyrics = await generateLyrics(phrases, genre);
    return NextResponse.json(lyrics);
  } catch (err) {
    console.error("lyrics generation failed:", err);
    return NextResponse.json(
      { error: "The songwriter had writer's block — try again in a moment." },
      { status: 502 }
    );
  }
}
