/**
 * Stage 2 — life after Oregon: one crisp choice that adds contest score on top of land claim.
 */

export type Stage2Pick = "hop_push" | "smith" | "mercantile" | "cattle" | "modest";

export interface Stage2Outcome {
  pick: Stage2Pick;
  title: string;
  lines: string[];
  scoreBonus: number;
}

export function resolveStage2Pick(menuIndex: number, ctx: { hopKing: boolean }): Stage2Outcome | null {
  switch (menuIndex) {
    case 1: {
      if (ctx.hopKing) {
        return {
          pick: "hop_push",
          title: "Hop King of the valley",
          lines: [
            "You double down on kilns and contracts — Meeker’s Puyallup thread becomes your ledger.",
            "Investors quote your name beside Ezra’s in the same breath (almost).",
          ],
          scoreBonus: 520,
        };
      }
      return {
        pick: "hop_push",
        title: "Hops without the crown",
        lines: [
          "You plant Puyallup rows anyway — smaller stake, smaller crown, honest sweat.",
          "The Sound market still learns your wagon number at the weigh-in.",
        ],
        scoreBonus: 260,
      };
    }
    case 2:
      return {
        pick: "smith",
        title: "Iron on the edge of nowhere",
        lines: [
          "Anvil, tongs, and rumor — every settlement needs a smith who keeps promises.",
          "You trade sparks for silver; ox shoes pay the winter.",
        ],
        scoreBonus: 300,
      };
    case 3:
      return {
        pick: "mercantile",
        title: "Kettles, cloth, and credit",
        lines: [
          "Dry goods behind a counter — beans, bolts, and the slow math of trust.",
          "Folks remember who shorted them once; you don’t.",
        ],
        scoreBonus: 260,
      };
    case 4:
      return {
        pick: "cattle",
        title: "Horns on the horizon",
        lines: [
          "You push stock north — grass, mud, and the long low politics of range rights.",
          "Brands outlast speeches.",
        ],
        scoreBonus: 340,
      };
    case 5:
      return {
        pick: "modest",
        title: "Quiet acre",
        lines: [
          "No headline — fence, field, and enough left over to sleep through thunder.",
          "Sometimes the trail ends in a door that actually closes.",
        ],
        scoreBonus: 190,
      };
    default:
      return null;
  }
}
