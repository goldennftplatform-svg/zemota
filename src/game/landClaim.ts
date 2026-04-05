export type LandChoice =
  | "oregon_donation"
  | "homestead_style"
  | "washington_fee"
  | "puyallup_hops";

export interface LandOutcome {
  title: string;
  body: string;
  feeCents: number;
  hopKing: boolean;
  scoreBonus: number;
}

export function resolveLandChoice(
  choice: LandChoice,
  triviaCorrect: number,
  moneyCents: number,
): LandOutcome {
  switch (choice) {
    case "oregon_donation":
      return {
        title: "Donation land claim (Oregon)",
        body:
          "You file papers and prove improvement. Fees and survey costs still bite — but you are in the story emigrants told themselves: land for labor.\n\nPLACEHOLDER: Insert Ezra-era statute names and filing costs from your records.",
        feeCents: 35_00,
        hopKing: false,
        scoreBonus: 400,
      };
    case "homestead_style":
      return {
        title: "Slower improvement / ‘free’ claim path",
        body:
          "You take longer to ‘prove up’ and spend more seasons under canvas. Cash outlay is lower today, but winter is expensive in health.\n\nTeaching: ‘free’ land was never free in risk or labor.",
        feeCents: 8_00,
        hopKing: false,
        scoreBonus: 250,
      };
    case "washington_fee":
      return {
        title: "North toward Puget Sound (Washington fees)",
        body:
          "You pay territorial fees and filings common to Washington’s boom towns. The map shifts from Willamette headlines to Sound commerce.\n\nPLACEHOLDER: Compare to Ezra’s actual filings.",
        feeCents: 55_00,
        hopKing: false,
        scoreBonus: 500,
      };
    case "puyallup_hops":
      return {
        title: "Puyallup Valley — hop king ambition",
        body:
          triviaCorrect >= 5
            ? "Your trivia notebook convinces investors you understand the hop market. You stake acres near the Puyallup, build kilns, and the camp calls you ‘Hop King’ — the Ezra easter egg ending.\n\nReplace prose with your archive: boom, bust, and Meeker’s promotions."
            : "You try hops without enough homework — the soil works, but creditors circle. You survive, but the crown of ‘Hop King’ slips to better-prepared rivals.\n\nTeaching: the ‘secret’ is really literacy in your own sources.",
        feeCents: Math.min(moneyCents, 40_00),
        hopKing: triviaCorrect >= 5,
        scoreBonus: triviaCorrect >= 5 ? 2500 : 600,
      };
  }
}
