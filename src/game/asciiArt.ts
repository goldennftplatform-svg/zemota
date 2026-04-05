/** Pop-up “ASIC” / terminal ASCII flair for EMOTA */

export const ART = {
  wagon: `
    ___________
   |  ___      |
   | |___|  O  |
  [===|===|====]
     o     o
`.trim(),

  storm: `
     .--.      
  .-(    )-.   ⚡
 (  ~LIGHT~  )
  '-.(____).-'
`.trim(),

  river: `
  ~~~~~~~~~~~~
 ~  RIVER!!  ~
  ~~~~~~~~~~~~
`.trim(),

  skull: `
   .-.
  (x x)
   '-' 
`.trim(),

  trader: `
   [====]
   | $$ |<
   [====]
`.trim(),

  luck: `
    ★
   /|\\
    |
`.trim(),

  herd: `
   m  m  m
  (ee)(ee)
`.trim(),

  night: `
  .  *  . *
    *   .
  *  .  *
`.trim(),

  milestone: `
  *** @@@ ***
   >>> mi >>>
`.trim(),

  wheel: `
    (O)
   //|\\\\
`.trim(),

  cabin: `
  /\\\\
 |___|
`.trim(),
} as const;

export type ArtKey = keyof typeof ART;
