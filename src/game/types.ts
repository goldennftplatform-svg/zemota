export type ProfileId =
  | "banker"
  | "farmer"
  | "blacksmith"
  | "goldSeeker"
  | "companyAgent";

export type DeathCause =
  | "dysentery"
  | "snake_bite"
  | "cholera"
  | "drowning"
  | "exhaustion"
  | "wagon_accident"
  | "mountain_fever";

export interface PartyMember {
  name: string;
  health: number;
  alive: boolean;
  cause?: DeathCause;
}

export interface GameInventory {
  oxen: number;
  foodLbs: number;
  moneyCents: number;
  ammo: number;
  clothes: number;
  spareWheels: number;
  spareAxles: number;
}

export type Pace = "steady" | "strenuous" | "grueling";
export type Rations = "filling" | "meager" | "bare_bones";

export interface Landmark {
  name: string;
  milesFromStart: number;
  river?: boolean;
  blurb: string;
}

export interface DashboardPartyRow {
  name: string;
  health: number;
  alive: boolean;
}

export type PopupVibe = "storm" | "gold" | "doom" | "river" | "trail" | "luck" | "mile";

export interface EmotaPopup {
  title: string;
  art: string;
  body: string[];
  vibe: PopupVibe;
}

export interface DashboardSnapshot {
  day: number;
  maxDays: number;
  miles: number;
  totalMiles: number;
  landmark: string;
  money: string;
  food: number;
  ammo: number;
  oxen: number;
  clothes: number;
  spareParts: string;
  pace: string;
  rations: string;
  alive: number;
  partyCap: number;
  profileTitle: string;
  triviaStreak: number;
  party: DashboardPartyRow[];
  /** Stable device id for contests / roll call. */
  travelerNumber: number;
}
