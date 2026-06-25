/**
 * Curated facts from Hop King / Meeker Mansion museum history.
 * Source: https://thehopking.com/mansion-history (Dennis Larsen · Puyallup Historical Society)
 */

export const MEEKER_MANSION_HISTORY_URL = "https://thehopking.com/mansion-history";

export const MANSION_SHORT =
  "Meeker Mansion · 312 Spring Street, Puyallup · Italianate Victorian · built 1890 · National Register 1972";

/** Training slideshow — real history before the warm-up quiz. */
export const TRAINING_MANSION_PAGES: string[][] = [
  [
    "The trail is only half the story — hops are the punchline.",
    "• 1852: Iowa to Oregon by ox wagon — Ezra Morgan Meeker (1830–1928) arrived Portland nearly broke.",
    "• 1862+: homesteaded Puyallup; 500+ acres of hops — Pacific Northwest Hop King. Meeker Mansion (1890) is the real epilogue.",
  ],
  [
    "Save the Oregon Trail",
    "• From age 76, Ezra retraced the trail by ox cart, automobile, and airplane so America would not forget the road.",
    "• His 1906–1926 monument crusade filled museums — including the wagon & papers now at Washington State Historical Society.",
  ],
  [
    "The Mansion & today",
    "• 1886–1890: Ezra commissioned an Italianate Victorian at 312 Spring Street — six fireplaces, stained glass, speaking tubes.",
    "• Puyallup Historical Society has stewarded it since 1970. Play → name your wagon → survive the trail → claim your land.",
  ],
];

export const TRAINING_MANSION_COACH: string[] = [
  "Young Ezra at jump-off — the Oregon Trail gets you west; Puyallup hops and the mansion are why his name stuck.",
  "Daily quizzes pull from Ezra’s 1852 diary, hop boom, mansion, and trail-saving years.",
  "Three warm-up questions next, then you name your party and hit Independence.",
];

export type MansionTimelineNote = { title: string; lines: string[] };

export const MANSION_TIMELINE_NOTES: MansionTimelineNote[] = [
  {
    title: "May 1852 · Missouri River",
    lines: [
      "Ezra watched emigrants dig a buried ferryboat from sand and run it while sheriffs bluffed — guns appeared, the crossing held.",
      "Hundreds of wagons waited weeks; Meeker later called the steamboat rush that overtook them ‘a thousand wagons.’",
    ],
  },
  {
    title: "June 1852 · Pawnee pass-by",
    lines: [
      "Diarist Eliza McAuley recorded Pawnees greeting Ezra’s tiny band with a civil ‘howdydo’ — then stripping a larger train of knives and tobacco.",
      "Ezra nursed brother Oliver through suspected cholera while neighbors rode on — William Buck stayed without being asked.",
    ],
  },
  {
    title: "Fort Boise · wagon-box ferry",
    lines: [
      "The Meeker brothers raced ahead on foot, built a ferry from a wagon box, and sold crossings — Edward Jay Allen bought them out in 1852.",
      "Fifty years later Allen’s diary proved the deal; both men had forgotten the partnership until they read it together in Pittsburgh.",
    ],
  },
  {
    title: "October 1852 · Portland",
    lines: [
      "The Meekers landed with $3.25 in their pockets. Ezra loaded the bark Mary Melville for $40; Oliver ran a boarding house at St. Helens.",
      "From The Dalles they floated the Columbia; passengers sang ‘Home Sweet Home’ as a young husband died aboard the scow.",
    ],
  },
  {
    title: "1865–1885 · Hop King",
    lines: [
      "Ezra scaled Puyallup hops to 500+ acres — he bragged when English rivals faltered, yet forgave ~$100,000 in local hop debts when the valley bust hit.",
      "That compassion and risk-taking is the same Meeker who would later beg the nation to remember the Oregon Trail.",
    ],
  },
  {
    title: "December 1890 · Mansion done",
    lines: [
      "The Italianate Victorian at 312 Spring Street finished in December 1890 — bay windows, prismatic stained glass, nickel speaking tubes on every floor.",
      "Six original fireplaces, each with unique hand-painted tile — no two mantles alike.",
    ],
  },
  {
    title: "1906 · Pioneer costume",
    lines: [
      "Ezra dropped the Hop King business suit and dressed as an aging pioneer — beard, hat, and all — for his trail monument tours.",
      "He used early motion pictures and newspapers the way a modern creator uses video: promotion in service of memory.",
    ],
  },
  {
    title: "1970 · Preservation",
    lines: [
      "The Puyallup Historical Society acquired Meeker Mansion and began decades of restoration — listed on the National Register in July 1972.",
      "The dining room today includes a display correcting Ezra’s omission of the Ballard family from his 1852 reminiscences.",
    ],
  },
  {
    title: "Eliza Jane · partner",
    lines: [
      "Eliza Jane Sumner married Ezra at sixteen in 1851; she celebrated her seventeenth birthday in a covered wagon bound for Iowa.",
      "Letters show she was a full partner in enterprises — not just wife and mother of six.",
    ],
  },
  {
    title: "Devil’s Gate · 1854",
    lines: [
      "On the 1854 return trip with his parents, eighteen-year-old Clark Meeker drowned in the Sweetwater at Devil’s Gate — Oliver searched the gorge calling his name.",
      "The Meeker train buried him that afternoon and pressed on toward Puget Sound.",
    ],
  },
  {
    title: "Donation land rush",
    lines: [
      "Congress shortened residency but added $1.25 per acre; the Donation Land Claim Act expired December 1, 1855 — families rushed the Olympia land office even during the Indian War.",
      "Ezra and Eliza filed adjacent to Oliver and Amanda; patents finally arrived in 1883 after twenty years of title fights.",
    ],
  },
  {
    title: "2026 · Heritage Center",
    lines: [
      "Groundbreaking for Ezra’s Heritage Center — a $35 million chapter so the mansion story outlives all of us.",
      "Visit the museum at thehopking.com/mansion-history · tours support the stewards who keep the house alive.",
    ],
  },
];

export function pickMansionTimelineNote(): MansionTimelineNote {
  return MANSION_TIMELINE_NOTES[Math.floor(Math.random() * MANSION_TIMELINE_NOTES.length)]!;
}

export const MANSION_TRAIL_FLAVOR: string[] = [
  "Someone quotes Ezra: ‘Nothing illustrates absurd rivalry like Farquharson — the attorneys came out ahead.’",
  "A traveler hums a line Ezra later used in speeches — the Platte dust swallows the tune.",
  "Camp talk turns to hop prices in Puyallup — nobody believes the boom yet.",
  "An old-timer mentions speaking tubes in a house on Spring Street — you assume it’s a fairy tale.",
  "Wind rattles canvas like stained glass in a mansion you have never seen.",
  "A diary page blows past: ‘May 29 — Meekers camp with us tonight, no tent yet.’",
  "Stars over the Platte look like the prismatic light Ezra would later describe in his parlor.",
];

export function pickMansionTrailFlavor(): string {
  return MANSION_TRAIL_FLAVOR[Math.floor(Math.random() * MANSION_TRAIL_FLAVOR.length)]!;
}

/** Extra landmark blurbs keyed by landmark name (appended in map.ts). */
export const MANSION_LANDMARK_ADDENDUM: Record<string, string> = {
  "Chimney Rock":
    "Near here Jacob Meeker’s wife Phoebe died of cholera in June 1854 on the family’s second overland trip — Ezra’s 1852 train had already passed this spire.",
  "Independence Rock":
    "Devil’s Gate on the Sweetwater — where Clark Meeker drowned in 1854 — lies ahead in the Meeker family’s later journey; emigrants still carved names on this rock for July 4th.",
  "Fort Boise":
    "In 1852 the Meeker brothers sold wagon-box ferry rights here; in 1854 trail papers warned of Indian attacks — the Ward Massacre smell reached trains fifty miles away.",
  "Snake River":
    "Ezra’s 1852 party worked the south bank toward Three Island Crossing — ferries, profit, and drowned stock mark Idaho in every reminiscence.",
  "The Dalles":
    "Meeker floated the Columbia from here in a great scow — women, children, and the ill — while young men drove stock down the rough road to Portland.",
  "Oregon City":
    "Ezra Meeker finished his 1852 trail here October 1 with $3.25 left — donation claims, Puget Sound, hops, mansion, and trail monuments all lay ahead.",
};

/** Quick museum stats (Hop King / Meeker Mansion site). */
export const BIGBOARD_MUSEUM_STATS: { k: string; v: string }[] = [
  { k: "Built", v: "1890" },
  { k: "Fireplaces", v: "6" },
  { k: "NRHP", v: "1972" },
  { k: "Hop peak", v: "500+ ac" },
];

const BIGBOARD_TRAIL_HISTORY: { maxMiles: number; title: string; body: string }[] = [
  {
    maxMiles: 150,
    title: "March 1852 · Iowa",
    body: "Marion Jasper Meeker was six weeks old when the wagons rolled — Eliza Jane packed food for six months on the trail.",
  },
  {
    maxMiles: 320,
    title: "May 1852 · Missouri River",
    body: "Emigrants dug a buried ferry from the sand; Ezra wrote that a hundred guns appeared before the sheriff stood down.",
  },
  {
    maxMiles: 550,
    title: "June 1852 · Pawnee country",
    body: "Eliza McAuley's diary records the Meeker band — the kind of eyewitness history Ezra later crusaded to save.",
  },
  {
    maxMiles: 850,
    title: "Platte & Laramie",
    body: "At 76, Ezra would dress as an aging pioneer and retrace this road by ox cart, auto, and airplane.",
  },
  {
    maxMiles: 1150,
    title: "Sweetwater · Devil's Gate",
    body: "In 1854 young Clark Meeker drowned here on the family's return trip — Oliver searched the gorge calling his name.",
  },
  {
    maxMiles: 1400,
    title: "Fort Boise · Snake River",
    body: "The Meeker brothers sold wagon-box ferry rights in 1852; Edward Jay Allen's diary later proved the deal.",
  },
  {
    maxMiles: 1750,
    title: "The Dalles · Columbia",
    body: "Meeker floated the great scow toward Portland — the Columbia leg that finished his 1852 journey.",
  },
  {
    maxMiles: 1990,
    title: "October 1852 · Portland",
    body: "The Meekers arrived with $3.25 in their pockets — hops, the 1890 mansion, and trail monuments lay ahead.",
  },
];

const BIGBOARD_MANSION_EXTRAS: { title: string; body: string }[] = [
  {
    title: "Italianate Victorian",
    body: "Ornate brackets, bay windows, and prismatic stained glass at 312 Spring Street, Puyallup.",
  },
  {
    title: "Speaking tubes",
    body: "Nickel-plated speaking tubes still connect every floor — Gilded-Age domestic technology.",
  },
  {
    title: "Hop King era",
    body: "1865–1885: Ezra cultivated 500+ acres of hops and revolutionized valley agriculture.",
  },
  {
    title: "Forgiven debts",
    body: "When the hop bust hit, Ezra forgave ~$100,000 in local hop loans — roughly $4M today.",
  },
  {
    title: "Trail crusade wagon",
    body: "January 1919: Ezra donated his monument wagon and ~50,000 pages of papers to Washington State Historical Society.",
  },
  {
    title: "Heritage Center 2026",
    body: "Groundbreaking for Ezra's Heritage Center — a $35M chapter so the mansion story endures.",
  },
  {
    title: "Puyallup Historical Society",
    body: "Volunteers acquired the mansion in 1970 — 50+ years stewarding a National Register treasure.",
  },
];

/** Extra rotating wall facts — trail, hops, Ezra, Pacific Northwest. */
const BIGBOARD_MORE_FACTS: { title: string; body: string }[] = [
  {
    title: "5′1″ mile maker",
    body: "Ezra Meeker stood barely five feet one — small in stature, enormous in mileage and memory.",
  },
  {
    title: "Peak trail year",
    body: "1852 is often called the flood year on the Oregon Trail — the same year the Meekers left Iowa with a six-week-old baby.",
  },
  {
    title: "Prairie schooners",
    body: "Canvas-topped wagons earned the nickname prairie schooners — sails of white crossing a sea of grass.",
  },
  {
    title: "Yakima hops today",
    body: "Washington still grows the majority of U.S. hops — aroma fields Ezra’s boom helped put on the map.",
  },
  {
    title: "Cascade hop",
    body: "The Cascade hop, released in the 1970s from Pacific Northwest breeding, still defines American pale ale.",
  },
  {
    title: "Cholera on the trail",
    body: "Cholera haunted river towns and wagon trains — Meeker’s diaries and neighbors’ letters repeat the same dread.",
  },
  {
    title: "April–May jump-off",
    body: "Most companies left Missouri in the April–May grass window — too early meant mud, too late meant snow in the mountains.",
  },
  {
    title: "Oxen thirst",
    body: "On hot days a single ox might drink eight to ten gallons — water was logistics, not scenery.",
  },
  {
    title: "Snake River crossing",
    body: "Three Island Crossing on the Snake terrified emigrants — rafts, ropes, and drowned stock in every reminiscence.",
  },
  {
    title: "Meeker's middle name",
    body: "Genealogists recovered Ezra’s true middle name: Morgan — not Manning, as decades of print had it wrong.",
  },
  {
    title: "Airplane at 90+",
    body: "In his nineties Ezra flew part of the trail route by airplane — headlines loved the stunt, Ezra loved the attention for history.",
  },
  {
    title: "Play the trail",
    body: "Scan the QR at zemota.vercel.app/play — your wagon shows on this board while you travel.",
  },
];

function factKey(f: { title: string; body: string }): string {
  return `${f.title}\0${f.body}`;
}

function buildBigboardFactPool(): { title: string; body: string; key: string }[] {
  const pool: { title: string; body: string; key: string }[] = [];
  const push = (title: string, body: string) => {
    const item = { title, body, key: factKey({ title, body }) };
    pool.push(item);
  };
  for (const h of BIGBOARD_TRAIL_HISTORY) push(h.title, h.body);
  for (const h of BIGBOARD_MANSION_EXTRAS) push(h.title, h.body);
  for (const h of BIGBOARD_MORE_FACTS) push(h.title, h.body);
  for (const n of MANSION_TIMELINE_NOTES) push(n.title, n.lines.join(" "));
  for (const [loc, blurb] of Object.entries(MANSION_LANDMARK_ADDENDUM)) push(loc, blurb);
  for (const line of MANSION_TRAIL_FLAVOR) push("On the trail", line);
  return pool;
}

let bigboardFactPoolCache: ReturnType<typeof buildBigboardFactPool> | null = null;

function getBigboardFactPool() {
  if (!bigboardFactPoolCache) bigboardFactPoolCache = buildBigboardFactPool();
  return bigboardFactPoolCache;
}

/** Random fact for the bigboard dock — avoids repeating the previous entry when possible. */
export function pickBigboardRotatingFact(
  leadMiles: number,
  landmark?: string,
  exceptKey?: string,
): { title: string; body: string } {
  const landmarkBlurb = landmarkHistoryBlurb(landmark);
  if (landmarkBlurb && landmark && Math.random() < 0.22) {
    const pick = { title: landmark, body: landmarkBlurb };
    if (factKey(pick) !== exceptKey) return pick;
  }
  if (Math.random() < 0.18) {
    const trail =
      BIGBOARD_TRAIL_HISTORY.find((h) => leadMiles <= h.maxMiles) ??
      BIGBOARD_TRAIL_HISTORY[BIGBOARD_TRAIL_HISTORY.length - 1]!;
    if (factKey(trail) !== exceptKey) return trail;
  }
  const pool = getBigboardFactPool();
  for (let i = 0; i < 14; i++) {
    const f = pool[Math.floor(Math.random() * pool.length)]!;
    if (f.key !== exceptKey) return { title: f.title, body: f.body };
  }
  const fallback = pool[Math.floor(Math.random() * pool.length)]!;
  return { title: fallback.title, body: fallback.body };
}

function landmarkHistoryBlurb(landmark?: string): string | undefined {
  if (!landmark) return undefined;
  const hit = Object.entries(MANSION_LANDMARK_ADDENDUM).find(
    ([key]) => landmark.includes(key) || key.includes(landmark),
  );
  return hit?.[1];
}

/** History panel for the live bigboard — use {@link pickBigboardRotatingFact} for wall rotation. */
export function bigboardHistoryContent(
  leadMiles: number,
  _tick = 0,
  landmark?: string,
): { title: string; body: string } {
  return pickBigboardRotatingFact(leadMiles, landmark);
}

/** Raw trivia — merged in trivia.ts */
export const MANSION_TRIVIA_RAW: {
  id: string;
  q: string;
  choices: string[];
  answer: number;
  teach: string;
  endgameWeight: number;
}[] = [
  {
    id: "mansion_year",
    q: "When was Meeker Mansion completed?",
    choices: ["December 1890", "July 1852", "1926", "1970"],
    answer: 0,
    teach: "The Italianate Victorian at 312 Spring Street, Puyallup was finished December 1890 — Ezra and Eliza Jane hosted Gilded-Age visitors there.",
    endgameWeight: 4,
  },
  {
    id: "mansion_fireplaces",
    q: "How many original fireplaces remain in Meeker Mansion?",
    choices: ["Six — each with unique tile and mantles", "One central hearth", "Twelve matching marble hearths", "None — all were removed"],
    answer: 0,
    teach: "Six fireplaces survive, no two alike — hand-painted tiles and carved mantles from the 1890 build.",
    endgameWeight: 3,
  },
  {
    id: "mansion_society",
    q: "Who has preserved Meeker Mansion since 1970?",
    choices: [
      "Puyallup Historical Society",
      "The U.S. National Park Service only",
      "Ezra’s private trust in Ohio",
      "Washington State University athletics",
    ],
    answer: 0,
    teach: "Volunteers of the Puyallup Historical Society acquired the house in 1970 and still maintain it as a museum.",
    endgameWeight: 4,
  },
  {
    id: "mansion_register",
    q: "Meeker Mansion joined the National Register of Historic Places in:",
    choices: ["July 1972", "December 1890", "1855", "1906"],
    answer: 0,
    teach: "National Register listing came July 1972 — recognizing the house as Gilded-Age heritage in the Pacific Northwest.",
    endgameWeight: 3,
  },
  {
    id: "hop_acres",
    q: "At the hop-industry peak, Ezra Meeker cultivated roughly:",
    choices: ["Over 500 acres of hops", "Five acres and a garden", "Only wheat and cattle", "No farmland — he was a banker"],
    answer: 0,
    teach: "The ‘Hop King’ era (1865–1885) saw 500+ acres of Puyallup Valley hops — revolutionizing valley agriculture.",
    endgameWeight: 5,
  },
  {
    id: "ezra_middle",
    q: "Ezra Meeker’s true middle name was:",
    choices: ["Morgan (not Manning)", "Manning as long thought", "He had no middle name", "Hopkins"],
    answer: 0,
    teach: "Genealogists recovered Morgan from Ezra’s maternal line — correcting decades of ‘Manning’ in print.",
    endgameWeight: 2,
  },
  {
    id: "marion_baby",
    q: "On the 1852 trail, Ezra and Eliza Jane’s baby Marion was:",
    choices: ["Six weeks old when they left Iowa", "Left behind with relatives", "A teenager driving oxen", "Not born until Oregon"],
    answer: 0,
    teach: "Marion Jasper Meeker was six weeks old when the wagons rolled — Eliza McAuley’s diary calls him ‘Dickie.’",
    endgameWeight: 1,
  },
  {
    id: "portland_cash",
    q: "When the Meekers reached Portland in October 1852 they had about:",
    choices: ["$3.25 in their pockets", "$3,000 from gold pans", "A land patent already", "A hop contract"],
    answer: 0,
    teach: "Nearly broke after the trail — Ezra worked the Mary Melville wharf for $40 while Oliver ran a boarding house.",
    endgameWeight: 1,
  },
  {
    id: "trail_retrace_age",
    q: "Ezra began his famous Oregon Trail retracing crusade at about age:",
    choices: ["76 — by ox cart first", "25 — before hops", "Never retraced it", "90 only by rail"],
    answer: 0,
    teach: "At 76 he launched the monument expedition (1906+) — wagon, auto, airplane, and foot to mark the vanishing route.",
    endgameWeight: 4,
  },
  {
    id: "speaking_tubes",
    q: "A Victorian marvel still in Meeker Mansion connects floors via:",
    choices: ["Nickel-plated speaking tubes", "Telegraph wires to Tacoma", "Pneumatic mail tubes", "Radio sets"],
    answer: 0,
    teach: "Functioning speaking tubes — domestic tech of the Gilded Age — link rooms through the 1890 house.",
    endgameWeight: 3,
  },
  {
    id: "dlc_fee",
    q: "Donation land claims on Puget Sound often required settlers to pay:",
    choices: ["$1.25 per acre after proving up", "Nothing — instant deed", "Only hops as currency", "British crown fees only"],
    answer: 0,
    teach: "The 1854 act added $1.25/acre; the rush to file before December 1855 hit even during the Indian War.",
    endgameWeight: 3,
  },
  {
    id: "puyallup_arrive",
    q: "Ezra Meeker first camped on the site of present-day Puyallup in:",
    choices: ["April 1853", "1890", "1970", "1926 only"],
    answer: 0,
    teach: "Scouting Puget Sound in 1853, the brothers entered the Puyallup River — huge trees discouraged them then, but hops came later.",
    endgameWeight: 4,
  },
  {
    id: "heritage_center",
    q: "Ezra’s Heritage Center (groundbreaking 2026) aims to:",
    choices: [
      "Expand museum stewardship for centuries",
      "Replace the mansion with condos",
      "Move the Oregon Trail to Ohio",
      "End all hop farming",
    ],
    answer: 0,
    teach: "A $35 million Heritage Center groundbreaking in 2026 continues the mansion’s public mission.",
    endgameWeight: 4,
  },
  {
    id: "wagon_donation",
    q: "Ezra donated his monument crusade wagon to Washington State Historical Society in:",
    choices: ["1919 — with tens of thousands of pages of papers", "1852", "1970", "Never — it was lost"],
    answer: 0,
    teach: "January 1919 — wagon, taxidermy oxen, and ~50,000 pages of letters; rediscovered in 1953 in a glass case.",
    endgameWeight: 3,
  },
  {
    id: "architecture_style",
    q: "Meeker Mansion’s architecture is best described as:",
    choices: ["Italianate Victorian", "Log cabin frontier", "Adobe mission", "Art Deco cinema"],
    answer: 0,
    teach: "Ornate brackets, bay windows, and decorative cornices — Gilded-Age residential design at its PNW finest.",
    endgameWeight: 3,
  },
];

export type MansionEncounterSpec = {
  id: string;
  title: string;
  intro: string[];
  choices: string[];
};

/** Art assigned in encounters.ts */
export const MANSION_ENCOUNTER_SPECS: MansionEncounterSpec[] = [
  {
    id: "mansion_ferry",
    title: "BURIED FERRY",
    intro: [
      "Emigrants dig a flatboat out of Missouri River sand — sheriffs bluff, rifles glint, the crossing resumes.",
      "Ezra Meeker wrote that a hundred guns appeared before the sheriff withdrew. Your train watches and learns.",
    ],
    choices: ["Wait for order (lose time)", "Help dig — earn goodwill", "Push ahead in the chaos (risk)"],
  },
  {
    id: "mansion_hop_rumor",
    title: "HOP RUMOR FROM THE SOUND",
    intro: [
      "A trader back from Puget Sound swears hops pay better than gold dust — if you survive the trail first.",
      "‘Five hundred acres,’ he lies or maybe doesn’t. ‘Ezra Meeker’s planting them now.’",
    ],
    choices: ["Buy a seed sack on credit ($4)", "Take notes — free history", "Laugh — Oregon’s enough"],
  },
  {
    id: "mansion_monument",
    title: "OLD MAN WITH A MAP",
    intro: [
      "A white-bearded promoter sketches trail markers on your flour sack — ‘Save the road,’ he says, ‘or America forgets.’",
      "You do not know his name yet. You will.",
    ],
    choices: ["Share food — he tells a true story", "Buy a cheap marker nail ($2)", "Move on — miles matter"],
  },
  {
    id: "mansion_spring_st",
    title: "DREAM OF SPRING STREET",
    intro: [
      "Camp fever: you imagine a house with stained glass and speaking tubes on a street called Spring.",
      "Wake to oxen, not fireplaces — but the dream sticks.",
    ],
    choices: ["Write it in the journal (morale +)", "Shake it off — hunt today", "Tell the party — split opinions"],
  },
];
