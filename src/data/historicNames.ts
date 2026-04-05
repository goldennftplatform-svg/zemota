/**
 * First names plausible for an 1840s–60s overland party (U.S. emigrant pool).
 * Avoids obviously modern spellings; players can edit the field.
 */
const POOL: readonly string[] = [
  "Abijah",
  "Almira",
  "Amos",
  "Angeline",
  "Asa",
  "Augusta",
  "Augustus",
  "Azubah",
  "Barnabas",
  "Beulah",
  "Caleb",
  "Calista",
  "Chester",
  "Cornelius",
  "Cyrus",
  "Delilah",
  "Drusilla",
  "Elias",
  "Eliphalet",
  "Emeline",
  "Enoch",
  "Ephraim",
  "Erastus",
  "Eunice",
  "Experience",
  "Ezra",
  "Hepsibah",
  "Hezekiah",
  "Hiram",
  "Horace",
  "Ichabod",
  "Ira",
  "Jasper",
  "Jerusha",
  "Joab",
  "Josiah",
  "Lavinia",
  "Lemuel",
  "Levi",
  "Lorenzo",
  "Lucinda",
  "Lyman",
  "Marilla",
  "Matilda",
  "Mercy",
  "Millard",
  "Minerva",
  "Myron",
  "Obadiah",
  "Orville",
  "Parthenia",
  "Patience",
  "Permelia",
  "Phineas",
  "Prudence",
  "Rhoda",
  "Rufus",
  "Selah",
  "Silas",
  "Solomon",
  "Sophronia",
  "Submit",
  "Sylvanus",
  "Sylvester",
  "Temperance",
  "Thaddeus",
  "Tryphena",
  "Warren",
  "Weltha",
  "Zebulon",
  "Zilpah",
];

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

/** Five comma-separated historic first names for the party field. */
export function randomHistoricPartyLine(): string {
  return shuffle([...POOL])
    .slice(0, 5)
    .join(", ");
}
