/**
 * Curated, sourced facts about Grand Theft Auto VI. Kept deliberately small:
 * anything detailed (missions, vehicles, characters…) is fetched live from the
 * GTA Wiki so it stays current. `asOf` tells the model how fresh this is.
 */

export const FACTS_AS_OF = "2026-11-21";

export const FACTS = {
  title: "Grand Theft Auto VI",
  developer: "Rockstar Games",
  publisher: "Rockstar Games (Take-Two Interactive)",
  releaseDate: "2026-11-19",
  platforms: ["PlayStation 5", "Xbox Series X|S"],
  pc: {
    status: "Not announced as of 2026-11-21.",
    reports: "GamesBeat reported (2026-10-13, anonymous sources) a PC release planned for early 2027. Unconfirmed by Rockstar.",
    precedent: "GTA V reached PC about 19 months after its console launch (2013-09-17 → 2015-04-14).",
  },
  setting: {
    state: "Leonida (a fictional take on Florida)",
    city: "Vice City",
    regionsNamedByRockstar: ["Vice City", "Leonida Keys", "Grassrivers", "Port Gellhorn", "Ambrosia", "Mount Kalaga National Park"],
  },
  protagonists: ["Lucia Caminos", "Jason Duval"],
  timeline: [
    { date: "2022-02-04", event: "Rockstar confirms the next Grand Theft Auto is in active development." },
    { date: "2023-12-04", event: "Trailer 1 released (a day early, after a leak)." },
    { date: "2025-05-02", event: "Release moved from 2025 to 2026-05-26." },
    { date: "2025-05-06", event: "Trailer 2 released; protagonists and Leonida regions detailed on the official site." },
    { date: "2025-11-06", event: "Release moved to 2026-11-19." },
    { date: "2026-11-19", event: "Launch on PlayStation 5 and Xbox Series X|S." },
  ],
  sources: [
    "https://www.rockstargames.com/VI",
    "https://www.rockstargames.com/newswire",
    "https://gta.fandom.com/wiki/Grand_Theft_Auto_VI",
  ],
} as const;

export type Console = "ps5" | "ps5-pro" | "xbox-series-x" | "xbox-series-s";

/** Button naming so answers use the player's own controller vocabulary. */
/** Physical button equivalents, so answers use the player's own controller vocabulary. */
export const BUTTONS: Record<"playstation" | "xbox", Record<string, string>> = {
  playstation: {
    faceBottom: "Cross (✕)", faceRight: "Circle (○)", faceLeft: "Square (□)", faceTop: "Triangle (△)",
    leftBumper: "L1", rightBumper: "R1", leftTrigger: "L2", rightTrigger: "R2",
    leftStickClick: "L3", rightStickClick: "R3", start: "Options", select: "Touchpad press", dpad: "D-pad",
  },
  xbox: {
    faceBottom: "A", faceRight: "B", faceLeft: "X", faceTop: "Y",
    leftBumper: "LB", rightBumper: "RB", leftTrigger: "LT", rightTrigger: "RT",
    leftStickClick: "Left stick click (LS)", rightStickClick: "Right stick click (RS)", start: "Menu (☰)", select: "View (⧉)", dpad: "D-pad",
  },
};

export function consoleFamily(c?: string): "playstation" | "xbox" | undefined {
  if (!c) return undefined;
  const v = c.toLowerCase();
  if (v.includes("ps") || v.includes("playstation")) return "playstation";
  if (v.includes("xbox") || v.includes("series")) return "xbox";
  return undefined;
}
