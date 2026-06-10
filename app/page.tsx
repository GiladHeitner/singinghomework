"use client";

import { useEffect, useMemo, useState } from "react";
import { GENRES, type Genre, type HistoryEntry, type LyricsResult } from "@/lib/types";

const HISTORY_KEY = "singinghomework-history";

type Stage = "idle" | "writing" | "recording" | "done" | "error";

const GENRE_EMOJI: Record<Genre, string> = {
  Pop: "🎤",
  "K-Pop": "💜",
  Rock: "🎸",
  Rap: "🔥",
  Country: "🤠",
  Lullaby: "🌙",
  EDM: "⚡",
  Showtune: "🎭",
};

function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function MarkedLyrics({ lyrics, phrases }: { lyrics: string; phrases: string[] }) {
  const lines = lyrics.split("\n");
  return (
    <div className="whitespace-pre-wrap leading-relaxed text-sm">
      {lines.map((line, i) => {
        if (/^\s*\[(verse|chorus|bridge)[^\]]*\]\s*$/i.test(line)) {
          return (
            <div key={i} className="mt-3 mb-1 text-xs font-bold uppercase tracking-widest text-violet-400">
              {line.replace(/[\[\]]/g, "")}
            </div>
          );
        }
        // Highlight homework phrases wherever they appear in a line.
        let segments: Array<{ text: string; mark: boolean }> = [{ text: line, mark: false }];
        for (const phrase of phrases) {
          if (!phrase) continue;
          segments = segments.flatMap((seg) => {
            if (seg.mark) return [seg];
            const parts = seg.text.split(new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i"));
            return parts
              .filter((p) => p !== "")
              .map((p) => ({ text: p, mark: p.toLowerCase() === phrase.toLowerCase() }));
          });
        }
        return (
          <div key={i}>
            {segments.map((seg, j) =>
              seg.mark ? (
                <mark key={j} className="bg-violet-200 dark:bg-violet-800 dark:text-violet-50 rounded px-0.5">
                  {seg.text}
                </mark>
              ) : (
                <span key={j}>{seg.text}</span>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [input, setInput] = useState("");
  const [genre, setGenre] = useState<Genre>("Pop");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");
  const [current, setCurrent] = useState<HistoryEntry | null>(null);
  const [pendingLyrics, setPendingLyrics] = useState<LyricsResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    // localStorage is client-only; hydrate history after mount to avoid SSR mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(loadHistory());
  }, []);

  const phrases = useMemo(
    () =>
      input
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    [input]
  );

  function saveHistory(next: HistoryEntry[]) {
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }

  async function generate() {
    if (phrases.length === 0 || stage === "writing" || stage === "recording") return;
    setError("");
    setCurrent(null);
    setPendingLyrics(null);
    setStage("writing");
    try {
      const lyricsRes = await fetch("/api/lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrases, genre }),
      });
      const lyricsData = await lyricsRes.json();
      if (!lyricsRes.ok) throw new Error(lyricsData.error ?? "Lyrics failed");
      const lyrics: LyricsResult = lyricsData;
      setPendingLyrics(lyrics);
      setStage("recording");

      const songRes = await fetch("/api/song", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lyrics: lyrics.lyrics,
          styleTags: lyrics.styleTags,
          title: lyrics.title,
        }),
      });
      const songData = await songRes.json();
      if (!songRes.ok) throw new Error(songData.error ?? "Song failed");

      const entry: HistoryEntry = {
        id: `${Date.now()}`,
        title: lyrics.title,
        genre,
        phrases,
        lyrics: lyrics.lyrics,
        audioUrl: songData.audioUrl,
        createdAt: new Date().toISOString(),
      };
      setCurrent(entry);
      setStage("done");
      saveHistory([entry, ...history].slice(0, 100));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("error");
    }
  }

  const busy = stage === "writing" || stage === "recording";
  const shownLyrics = current ?? pendingLyrics;
  const shownPhrases = current?.phrases ?? phrases;

  return (
    <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight flex items-center justify-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mascot.svg" alt="" className="h-12 w-12" />
          <span>
            Singing<span className="text-violet-500">Homework</span>
          </span>
        </h1>
        <p className="mt-2 text-sm opacity-70">
          Paste what you need to memorize. Get a song you can&apos;t forget.
        </p>
      </header>

      <div className="grid gap-8 md:grid-cols-[1fr_280px]">
        <section>
          <label className="block text-sm font-semibold mb-2">
            What do you need to memorize?{" "}
            <span className="opacity-60 font-normal">(one item per line)</span>
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={5}
            placeholder={
              "mitochondria is the powerhouse of the cell\nosmosis moves water from low to high solute concentration"
            }
            className="w-full rounded-xl border border-black/15 dark:border-white/20 bg-transparent p-4 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />

          <div className="mt-4 flex flex-wrap gap-2">
            {GENRES.map((g) => (
              <button
                key={g}
                onClick={() => setGenre(g)}
                className={`rounded-full px-4 py-1.5 text-sm border transition ${
                  genre === g
                    ? "bg-violet-600 text-white border-violet-600"
                    : "border-black/15 dark:border-white/20 hover:border-violet-400"
                }`}
              >
                {GENRE_EMOJI[g]} {g}
              </button>
            ))}
          </div>

          <button
            onClick={generate}
            disabled={busy || phrases.length === 0}
            className="mt-6 w-full rounded-xl bg-violet-600 py-4 text-lg font-bold text-white transition hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {stage === "writing" && "✍️ Qwen is writing your hit…"}
            {stage === "recording" && "🎙️ The band is recording… (up to a minute)"}
            {!busy && "🎵 Make my song"}
          </button>

          {stage === "error" && (
            <p className="mt-4 rounded-lg bg-red-500/10 border border-red-500/40 p-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          {shownLyrics && (
            <div className="mt-8 rounded-xl border border-black/10 dark:border-white/15 p-5">
              <h2 className="text-xl font-bold">{shownLyrics.title}</h2>
              {current ? (
                <audio controls src={current.audioUrl} className="mt-3 w-full" autoPlay />
              ) : (
                <p className="mt-2 text-sm animate-pulse opacity-70">
                  🎙️ Recording the vocals — read along while you wait…
                </p>
              )}
              <div className="mt-4">
                <MarkedLyrics lyrics={shownLyrics.lyrics} phrases={shownPhrases} />
              </div>
            </div>
          )}
        </section>

        <aside>
          <h2 className="text-sm font-semibold mb-3 uppercase tracking-wide opacity-70">
            Your songs
          </h2>
          {history.length === 0 && (
            <p className="text-sm opacity-50">No songs yet — make your first hit! 🌟</p>
          )}
          <ul className="space-y-3">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg border border-black/10 dark:border-white/15 p-3"
              >
                <button
                  onClick={() => {
                    setCurrent(entry);
                    setPendingLyrics(null);
                    setStage("done");
                  }}
                  className="text-left w-full"
                >
                  <div className="text-sm font-semibold truncate">{entry.title}</div>
                  <div className="text-xs opacity-60">
                    {GENRE_EMOJI[entry.genre] ?? "🎵"} {entry.genre} ·{" "}
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </div>
                </button>
                <div className="mt-2 flex items-center justify-between">
                  <audio
                    controls
                    src={entry.audioUrl}
                    className="h-8 w-full max-w-[180px]"
                    preload="none"
                  />
                  <button
                    onClick={() => saveHistory(history.filter((h) => h.id !== entry.id))}
                    className="ml-2 text-xs opacity-50 hover:opacity-100 hover:text-red-500"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </main>
  );
}
