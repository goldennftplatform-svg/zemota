/** Run-in-progress snapshot (device-local). High scores use a separate key. */
export const EMOTA_RUN_SAVE_KEY = "emota_run_save_v1";

const RESUME_PHASE_LABEL: Record<string, string> = {
  training_text: "Training",
  training_quiz: "Warm-up quiz",
  party_names: "Naming party",
  profile: "Picking profession",
  store: "At the store",
  travel_menu: "Camp",
  river: "River crossing",
  travel_log: "Journal",
  trail_event: "Trail event",
  overhead_hunt: "Hunting",
  chance_pick: "Games",
  chance_play: "At the table",
  chance_result: "Games",
  trivia: "Quiz",
  land_pick: "Land claim",
  land_build: "Building",
  land_result: "Claim result",
  game_over: "Game over",
  victory: "Score screen",
};

export function peekRunSaveMeta(): { day: number; miles: number; phaseLabel: string } | null {
  try {
    const raw = localStorage.getItem(EMOTA_RUN_SAVE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as { v?: unknown; day?: unknown; miles?: unknown; phase?: unknown };
    if (o.v !== 1) return null;
    if (typeof o.day !== "number" || typeof o.miles !== "number" || typeof o.phase !== "string") return null;
    if (o.phase === "title") return null;
    return {
      day: Math.max(1, Math.floor(o.day)),
      miles: Math.max(0, Math.round(o.miles)),
      phaseLabel: RESUME_PHASE_LABEL[o.phase] ?? "On the trail",
    };
  } catch {
    return null;
  }
}

export function clearRunSave(): void {
  localStorage.removeItem(EMOTA_RUN_SAVE_KEY);
}

export function tryPersistRun(engine: { toRunSaveJSON(): string | null }): void {
  const j = engine.toRunSaveJSON();
  if (j) localStorage.setItem(EMOTA_RUN_SAVE_KEY, j);
}

export function tryResumeRun(engine: { applyRunSaveJSON(raw: string): boolean }): boolean {
  try {
    const raw = localStorage.getItem(EMOTA_RUN_SAVE_KEY);
    if (!raw) return false;
    return engine.applyRunSaveJSON(raw);
  } catch {
    return false;
  }
}
