import os from "node:os";
import { BUTTONS, consoleFamily, FACTS, FACTS_AS_OF } from "./facts.js";

export function platformReport(consoleArg?: string) {
  const configured = consoleArg ?? process.env.GTA6_PLATFORM ?? undefined;
  const family = consoleFamily(configured);
  const osName = process.platform === "darwin" ? "macOS" : process.platform === "win32" ? "Windows" : process.platform === "linux" ? "Linux" : process.platform;
  return {
    computer: { os: osName, release: os.release(), arch: process.arch },
    gameOnThisComputer:
      `Not available: as of ${FACTS_AS_OF} GTA VI is released only on ${FACTS.platforms.join(" and ")}. ` +
      (process.platform === "darwin"
        ? "There is no Mac version and none has been announced."
        : `PC: ${FACTS.pc.status} ${FACTS.pc.reports}`),
    saveFiles: "Console saves are not accessible from a computer, so this server answers from the GTA Wiki and official facts rather than your save. Tell Claude your progress (chapter, missions done, money) for tailored tips.",
    playerConsole: configured ?? "not set (set GTA6_PLATFORM to ps5, ps5-pro, xbox-series-x or xbox-series-s, or pass console)",
    controllerVocabulary: family ? BUTTONS[family] : BUTTONS,
    note: "Button names are physical equivalents only; check the in-game controls menu for exact GTA VI bindings.",
  };
}
