export type Genre =
  | "Pop"
  | "K-Pop"
  | "Rock"
  | "Rap"
  | "Country"
  | "Lullaby"
  | "EDM"
  | "Showtune";

export const GENRES: Genre[] = [
  "Pop",
  "K-Pop",
  "Rock",
  "Rap",
  "Country",
  "Lullaby",
  "EDM",
  "Showtune",
];

export interface LyricsResult {
  title: string;
  /** Full lyrics with ACE-Step structure tags: [verse], [chorus], [bridge] */
  lyrics: string;
  /** Comma-separated ACE-Step style tags, e.g. "pop, female vocals, catchy, upbeat" */
  styleTags: string;
}

export interface SongResult {
  audioUrl: string;
  provider: "huggingface" | "fal";
}

export interface HistoryEntry {
  id: string;
  title: string;
  genre: Genre;
  phrases: string[];
  lyrics: string;
  audioUrl: string;
  createdAt: string;
}
