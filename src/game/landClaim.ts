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

const MANSION_LINK = "https://thehopking.com/mansion-history";

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
          "You file papers and prove improvement — like the 1850s donation era Ezra knew before Puget Sound.\n\nCongress later added fees ($1.25/acre) and deadlines; the Meekers waited years for clear title on their claims.",
        feeCents: 35_00,
        hopKing: false,
        scoreBonus: 400,
      };
    case "homestead_style":
      return {
        title: "Slower improvement / ‘free’ claim path",
        body:
          "You take longer to prove up and spend more seasons under canvas. Cash outlay is lower today, but winter costs health.\n\nEzra’s first Kalama squatter cabin (1853) was taken from necessity — not ideal land, but a roof while broke.",
        feeCents: 8_00,
        hopKing: false,
        scoreBonus: 250,
      };
    case "washington_fee":
      return {
        title: "North toward Puget Sound (Washington fees)",
        body:
          "You pay territorial fees toward Olympia filings — the same rush that sent Ezra, Oliver, Jesse, and Hannah to the land office in November 1855, even as the Indian War flared.\n\nPatents on disputed Hudson’s Bay lands took decades; Ezra & Eliza Jane’s finally arrived June 20, 1883.",
        feeCents: 55_00,
        hopKing: false,
        scoreBonus: 500,
      };
    case "puyallup_hops":
      return {
        title: "Puyallup Valley — hop king ambition",
        body:
          triviaCorrect >= 5
            ? `Your trail notebook reads like Dennis Larsen’s archives — you stake hops near where Ezra would build Meeker Mansion (312 Spring Street, finished December 1890).\n\n500+ acres, kilns, and promotion: the valley calls you Hop King. The house with six fireplaces and speaking tubes awaits the boom.\n\n${MANSION_LINK}`
            : `You plant Puyallup hops without enough homework — soil works, creditors circle. Ezra forgave $100,000 in hop debts when the valley bust; you survive without his mansion view.\n\nVisit the real story: ${MANSION_LINK}`,
        feeCents: Math.min(moneyCents, 40_00),
        hopKing: triviaCorrect >= 5,
        scoreBonus: triviaCorrect >= 5 ? 2500 : 600,
      };
  }
}
