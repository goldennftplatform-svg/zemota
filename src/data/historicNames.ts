/**
 * Period first names for an 1840s–60s overland party (U.S. emigrant pool).
 * 45 male · 28 female — five defaults picked as a mixed wagon (3M + 2F, shuffled).
 */

export const MALE_FIRST_NAMES: readonly string[] = [
  "Abijah",
  "Alonzo",
  "Amos",
  "Ambrose",
  "Asa",
  "Augustus",
  "Barnabas",
  "Caleb",
  "Chauncey",
  "Chester",
  "Cornelius",
  "Cyrus",
  "Elias",
  "Eliphalet",
  "Enoch",
  "Ephraim",
  "Erastus",
  "Ezra",
  "Gideon",
  "Hezekiah",
  "Hiram",
  "Horace",
  "Ichabod",
  "Ira",
  "Jasper",
  "Jedediah",
  "Joab",
  "Josiah",
  "Lemuel",
  "Levi",
  "Lorenzo",
  "Lyman",
  "Millard",
  "Moses",
  "Myron",
  "Obadiah",
  "Orville",
  "Phineas",
  "Reuben",
  "Rufus",
  "Silas",
  "Solomon",
  "Thaddeus",
  "Warren",
  "Zebulon",
] as const;

export const FEMALE_FIRST_NAMES: readonly string[] = [
  "Almira",
  "Angeline",
  "Azubah",
  "Beulah",
  "Calista",
  "Delilah",
  "Drusilla",
  "Emeline",
  "Eunice",
  "Hepsibah",
  "Jerusha",
  "Lavinia",
  "Lucinda",
  "Marilla",
  "Matilda",
  "Mercy",
  "Minerva",
  "Parthenia",
  "Patience",
  "Permelia",
  "Prudence",
  "Rhoda",
  "Sophronia",
  "Submit",
  "Temperance",
  "Tryphena",
  "Weltha",
  "Zilpah",
] as const;

export const HISTORIC_NAME_COUNTS = {
  male: MALE_FIRST_NAMES.length,
  female: FEMALE_FIRST_NAMES.length,
} as const;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

function pickN<T>(pool: readonly T[], n: number): T[] {
  return shuffle([...pool]).slice(0, n);
}

/** Five first names: 3 from male pool + 2 from female pool, order shuffled. */
export function randomHistoricPartyLine(): string {
  return randomHistoricPartyNames().join(", ");
}

export function randomHistoricPartyNames(): string[] {
  const males = pickN(MALE_FIRST_NAMES, 3);
  const females = pickN(FEMALE_FIRST_NAMES, 2);
  return shuffle([...males, ...females]);
}
