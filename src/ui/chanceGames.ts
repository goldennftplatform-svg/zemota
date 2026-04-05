/**
 * CRT-style chance mini-games — same 320×240 surface / palette spirit as hunt overhead.
 */

import type { ChanceGameId, ChanceSimPayload } from "../game/chance";

const W = 320;
const H = 240;
/** Time to read win/lose on the CRT before handing off to the text result screen. */
const RESULT_HOLD_MS = 3000;

const BG = "#001a0f";
const FG = "#39ff7a";
const DIM = "#1a6644";
const HI = "#8fffaa";
const WARN = "#ffcc66";

function rankLabel(n: number): string {
  if (n === 1) return "A";
  if (n >= 11) return n === 11 ? "J" : n === 12 ? "Q" : "K";
  return String(n);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawScanlines(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.globalAlpha = 0.06;
  for (let y = 0; y < H; y += 2) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, y, W, 1);
  }
  ctx.restore();
}

function drawHoldHint(ctx: CanvasRenderingContext2D, active: boolean): void {
  if (!active) return;
  ctx.save();
  ctx.fillStyle = HI;
  ctx.font = "11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("Next screen in a moment…", W / 2, H - 8);
  ctx.restore();
}

function drawFrame(ctx: CanvasRenderingContext2D, title: string, sub: string): void {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = DIM;
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, W - 8, H - 8);
  ctx.fillStyle = FG;
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`// ${title}`, 12, 10);
  ctx.fillStyle = HI;
  ctx.font = "12px monospace";
  ctx.fillText(sub, 12, 28);
}

type ShellPhase = "shuffle" | "pick" | "reveal";

interface ShellState {
  kind: "shell";
  phase: ShellPhase;
  peaPos: 0 | 1 | 2;
  swapIdx: number;
  swaps: [number, number][];
  pick?: 0 | 1 | 2;
  revealT: number;
  /** Slows shuffle so cups are followable */
  shuffleFrame: number;
}

interface CoinState {
  kind: "coin";
  phase: "call" | "flip";
  call?: "heads" | "tails";
  outcome?: "heads" | "tails";
  flipFrame: number;
}

interface DiceState {
  kind: "dice";
  phase: "ready" | "roll";
  rollFrame: number;
  a: number;
  b: number;
}

interface HiLoState {
  kind: "high_low";
  phase: "guess" | "deal";
  first: number;
  second: number;
  guess?: "high" | "low";
  dealFrame: number;
}

interface LottoState {
  kind: "lottery";
  phase: "pick" | "spin";
  pick?: number;
  draw: number;
  spinFrame: number;
}

interface KnifeState {
  kind: "knife";
  phase: "aim" | "done";
  power: number;
  dir: 1 | -1;
}

type MiniState = ShellState | CoinState | DiceState | HiLoState | LottoState | KnifeState;

export class ChanceMini {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private onKey: (e: KeyboardEvent) => void;
  private onPtr: (e: PointerEvent) => void;
  private running = false;
  private state: MiniState | null = null;
  private doneCb: ((p: ChanceSimPayload) => void) | null = null;
  private pendingFinish: { payload: ChanceSimPayload; until: number } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const c = canvas.getContext("2d");
    if (!c) throw new Error("2d context");
    this.ctx = c;
    this.onKey = (e) => this.handleKey(e);
    this.onPtr = (e) => this.handlePtr(e);
  }

  start(
    id: ChanceGameId,
    _stakeCents: number,
    onDone: (p: ChanceSimPayload) => void,
  ): void {
    this.stop();
    this.running = true;
    this.doneCb = onDone;
    window.addEventListener("keydown", this.onKey);
    this.canvas.addEventListener("pointerdown", this.onPtr, { passive: false });

    switch (id) {
      case "shell": {
        const peaPos = (Math.floor(Math.random() * 3) as 0 | 1 | 2);
        const swaps: [number, number][] = [];
        for (let i = 0; i < 18; i++) {
          const a = Math.floor(Math.random() * 3);
          let b = Math.floor(Math.random() * 3);
          while (b === a) b = Math.floor(Math.random() * 3);
          swaps.push([a, b]);
        }
        this.state = {
          kind: "shell",
          phase: "shuffle",
          peaPos,
          swapIdx: 0,
          swaps,
          revealT: 0,
          shuffleFrame: 0,
        };
        break;
      }
      case "coin":
        this.state = { kind: "coin", phase: "call", flipFrame: 0 };
        break;
      case "dice":
        this.state = {
          kind: "dice",
          phase: "ready",
          rollFrame: 0,
          a: 1,
          b: 1,
        };
        break;
      case "high_low": {
        let first = Math.floor(Math.random() * 13) + 1;
        this.state = {
          kind: "high_low",
          phase: "guess",
          first,
          second: first,
          dealFrame: 0,
        };
        break;
      }
      case "lottery":
        this.state = {
          kind: "lottery",
          phase: "pick",
          draw: Math.floor(Math.random() * 6) + 1,
          spinFrame: 0,
        };
        break;
      case "knife":
        this.state = { kind: "knife", phase: "aim", power: 0, dir: 1 };
        break;
    }
    this.loop();
  }

  stop(): void {
    this.running = false;
    window.removeEventListener("keydown", this.onKey);
    this.canvas.removeEventListener("pointerdown", this.onPtr);
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.state = null;
    this.pendingFinish = null;
    this.doneCb = null;
  }

  private scheduleFinish(p: ChanceSimPayload): void {
    if (this.pendingFinish) return;
    this.pendingFinish = { payload: p, until: performance.now() + RESULT_HOLD_MS };
  }

  private finish(p: ChanceSimPayload): void {
    const cb = this.doneCb;
    this.stop();
    cb?.(p);
  }

  private handleKey(e: KeyboardEvent): void {
    if (this.pendingFinish) return;
    if (!this.running || !this.state) return;
    if (e.target instanceof HTMLInputElement) return;
    const k = e.key.toLowerCase();

    if (this.state.kind === "shell" && this.state.phase === "pick") {
      const n = Number(e.key);
      if (n >= 1 && n <= 3) {
        e.preventDefault();
        this.state.pick = (n - 1) as 0 | 1 | 2;
        this.state.phase = "reveal";
        this.state.revealT = 0;
      }
      return;
    }

    if (this.state.kind === "coin" && this.state.phase === "call") {
      if (k === "1" || k === "h") {
        e.preventDefault();
        this.state.call = "heads";
        this.state.phase = "flip";
        this.state.outcome = Math.random() < 0.5 ? "heads" : "tails";
        this.state.flipFrame = 0;
      } else if (k === "2" || k === "t") {
        e.preventDefault();
        this.state.call = "tails";
        this.state.phase = "flip";
        this.state.outcome = Math.random() < 0.5 ? "heads" : "tails";
        this.state.flipFrame = 0;
      }
      return;
    }

    if (this.state.kind === "dice" && (this.state.phase === "ready" || this.state.phase === "roll")) {
      if (e.code === "Space" && this.state.phase === "ready") {
        e.preventDefault();
        this.state.phase = "roll";
        this.state.rollFrame = 0;
        this.state.a = Math.floor(Math.random() * 6) + 1;
        this.state.b = Math.floor(Math.random() * 6) + 1;
      }
      return;
    }

    if (this.state.kind === "high_low" && this.state.phase === "guess") {
      if (k === "1" || k === "h") {
        e.preventDefault();
        this.state.guess = "high";
        this.startHiLoDeal();
      } else if (k === "2" || k === "l") {
        e.preventDefault();
        this.state.guess = "low";
        this.startHiLoDeal();
      }
      return;
    }

    if (this.state.kind === "lottery" && this.state.phase === "pick") {
      const n = Number(e.key);
      if (n >= 1 && n <= 6) {
        e.preventDefault();
        this.state.pick = n;
        this.state.phase = "spin";
        this.state.spinFrame = 0;
      }
      return;
    }

    if (this.state.kind === "knife" && this.state.phase === "aim") {
      if (e.code === "Space") {
        e.preventDefault();
        const pow = this.state.power;
        const hit = pow >= 40 && pow <= 60;
        this.state.phase = "done";
        this.scheduleFinish({ game: "knife", power: pow, hit });
      }
    }
  }

  private startHiLoDeal(): void {
    if (this.state?.kind !== "high_low" || !this.state.guess) return;
    let second = Math.floor(Math.random() * 13) + 1;
    let guard = 0;
    while (second === this.state.first && guard++ < 20) {
      second = Math.floor(Math.random() * 13) + 1;
    }
    this.state.second = second;
    this.state.phase = "deal";
    this.state.dealFrame = 0;
  }

  private handlePtr(e: PointerEvent): void {
    if (this.pendingFinish) return;
    if (!this.running || !this.state) return;
    const r = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / r.width;
    const sy = this.canvas.height / r.height;
    const mx = (e.clientX - r.left) * sx;
    const my = (e.clientY - r.top) * sy;

    if (this.state.kind === "shell" && this.state.phase === "pick") {
      const cx = [72, 160, 248];
      for (let i = 0; i < 3; i++) {
        if (Math.abs(mx - cx[i]!) < 44 && my > 120 && my < 220) {
          e.preventDefault();
          this.state.pick = i as 0 | 1 | 2;
          this.state.phase = "reveal";
          this.state.revealT = 0;
          return;
        }
      }
    }

    if (this.state.kind === "coin" && this.state.phase === "call") {
      if (my > 130 && my < 200) {
        e.preventDefault();
        if (mx < W / 2) {
          this.state.call = "heads";
        } else {
          this.state.call = "tails";
        }
        this.state.phase = "flip";
        this.state.outcome = Math.random() < 0.5 ? "heads" : "tails";
        this.state.flipFrame = 0;
      }
    }

    if (this.state.kind === "dice" && this.state.phase === "ready") {
      if (mx > 80 && mx < 240 && my > 140 && my < 220) {
        e.preventDefault();
        this.state.phase = "roll";
        this.state.rollFrame = 0;
        this.state.a = Math.floor(Math.random() * 6) + 1;
        this.state.b = Math.floor(Math.random() * 6) + 1;
      }
    }

    if (this.state.kind === "high_low" && this.state.phase === "guess") {
      if (my > 130 && my < 210) {
        e.preventDefault();
        this.state.guess = mx < W / 2 ? "high" : "low";
        this.startHiLoDeal();
      }
    }

    if (this.state.kind === "lottery" && this.state.phase === "pick") {
      for (let i = 0; i < 6; i++) {
        const x = 36 + i * 48;
        if (mx >= x && mx <= x + 40 && my >= 130 && my <= 170) {
          e.preventDefault();
          this.state.pick = i + 1;
          this.state.phase = "spin";
          this.state.spinFrame = 0;
          return;
        }
      }
    }

    if (this.state.kind === "knife" && this.state.phase === "aim") {
      e.preventDefault();
      const pow = this.state.power;
      const hit = pow >= 40 && pow <= 60;
      this.state.phase = "done";
      this.scheduleFinish({ game: "knife", power: pow, hit });
    }
  }

  private loop = (): void => {
    if (!this.running) return;
    this.tick();
    if (!this.running) return;
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private tick(): void {
    if (this.pendingFinish) {
      if (performance.now() >= this.pendingFinish.until) {
        const p = this.pendingFinish.payload;
        this.pendingFinish = null;
        this.finish(p);
      }
      return;
    }

    const st = this.state;
    if (!st) return;

    if (st.kind === "shell") {
      if (st.phase === "shuffle") {
        st.shuffleFrame++;
        if (st.shuffleFrame % 2 !== 0) return;
        if (st.swapIdx < st.swaps.length) {
          const [i, j] = st.swaps[st.swapIdx]!;
          if (st.peaPos === i) st.peaPos = j as 0 | 1 | 2;
          else if (st.peaPos === j) st.peaPos = i as 0 | 1 | 2;
        }
        st.swapIdx++;
        if (st.swapIdx >= st.swaps.length) st.phase = "pick";
      } else if (st.phase === "reveal") {
        st.revealT++;
        if (st.revealT > 55 && st.pick !== undefined) {
          this.scheduleFinish({
            game: "shell",
            cupChoice: st.pick,
            peaPosition: st.peaPos,
          });
        }
      }
      return;
    }

    if (st.kind === "coin" && st.phase === "flip") {
      st.flipFrame++;
      if (st.flipFrame > 55 && st.call && st.outcome) {
        this.scheduleFinish({ game: "coin", call: st.call, outcome: st.outcome });
      }
      return;
    }

    if (st.kind === "dice" && st.phase === "roll") {
      st.rollFrame++;
      if (st.rollFrame > 50) {
        this.scheduleFinish({
          game: "dice",
          a: st.a,
          b: st.b,
          houseThreshold: 7,
        });
      }
      return;
    }

    if (st.kind === "high_low" && st.phase === "deal") {
      st.dealFrame++;
      if (st.dealFrame > 40 && st.guess) {
        this.scheduleFinish({
          game: "high_low",
          guess: st.guess,
          first: st.first,
          second: st.second,
        });
      }
      return;
    }

    if (st.kind === "lottery" && st.phase === "spin") {
      st.spinFrame++;
      if (st.spinFrame > 45 && st.pick !== undefined) {
        this.scheduleFinish({ game: "lottery", pick: st.pick, draw: st.draw });
      }
      return;
    }

    if (st.kind === "knife" && st.phase === "aim") {
      st.power += st.dir * 2.2;
      if (st.power >= 100) {
        st.power = 100;
        st.dir = -1;
      } else if (st.power <= 0) {
        st.power = 0;
        st.dir = 1;
      }
    }
  }

  private draw(): void {
    const ctx = this.ctx;
    const st = this.state;
    if (!st) return;

    if (st.kind === "shell") {
      drawFrame(ctx, "SHELL & PEA", "Watch the shuffle · then 1·2·3 or tap a cup");
      const cupX = [72, 160, 248];
      for (let i = 0; i < 3; i++) {
        const lift =
          st.phase === "reveal" && st.pick === i && st.revealT > 8 ? -28 : 0;
        ctx.fillStyle = DIM;
        roundRect(ctx, cupX[i]! - 28, 140 + lift, 56, 64, 8);
        ctx.fill();
        ctx.strokeStyle = FG;
        ctx.stroke();
        ctx.fillStyle = FG;
        ctx.font = "bold 18px monospace";
        ctx.textAlign = "center";
        ctx.fillText(String(i + 1), cupX[i]!, 175 + lift);
        if (st.phase === "reveal" && st.pick === i && st.revealT > 12) {
          const hasPea = st.peaPos === i;
          ctx.fillStyle = hasPea ? HI : WARN;
          ctx.font = "11px monospace";
          ctx.fillText(hasPea ? "● pea" : "empty", cupX[i]!, 218 + lift);
        }
      }
      if (st.phase === "shuffle") {
        ctx.fillStyle = WARN;
        ctx.font = "11px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`shuffling… ${st.swapIdx}/${st.swaps.length}`, W / 2, 210);
      }
      drawScanlines(ctx);
      drawHoldHint(ctx, !!this.pendingFinish);
      return;
    }

    if (st.kind === "coin") {
      drawFrame(ctx, "COIN FLIP", "1·H / 2·T or tap left/right");
      const o = st.outcome;
      const spin = st.phase === "flip" ? st.flipFrame : 0;
      const show = st.phase === "flip" && spin > 20;
      const face = show && o ? o : spin % 6 < 3 ? "heads" : "tails";
      ctx.textAlign = "center";
      ctx.font = "bold 28px monospace";
      ctx.fillStyle = HI;
      ctx.fillText(face === "heads" ? "H" : "T", W / 2, 110 + Math.sin(spin * 0.4) * 6);
      ctx.strokeStyle = DIM;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(W / 2, 115, 48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = DIM;
      roundRect(ctx, 48, 150, 100, 44, 6);
      ctx.fill();
      roundRect(ctx, 172, 150, 100, 44, 6);
      ctx.fill();
      ctx.fillStyle = FG;
      ctx.font = "12px monospace";
      ctx.fillText("HEADS", 98, 172);
      ctx.fillText("TAILS", 222, 172);
      drawScanlines(ctx);
      drawHoldHint(ctx, !!this.pendingFinish);
      return;
    }

    if (st.kind === "dice") {
      drawFrame(ctx, "BONE DICE", "SPACE or tap to roll · beat 7");
      const spin = (rf: number, final: number) =>
        st.phase === "roll" && rf < 45 ? 1 + ((rf * 7 + final * 3) % 6) : final;
      const da = spin(st.rollFrame, st.a);
      const db = spin(st.rollFrame, st.b);
      const drawDie = (x: number, y: number, v: number) => {
        ctx.fillStyle = "#0a3020";
        roundRect(ctx, x, y, 72, 72, 8);
        ctx.fill();
        ctx.strokeStyle = FG;
        ctx.stroke();
        ctx.fillStyle = FG;
        ctx.font = "bold 32px monospace";
        ctx.textAlign = "center";
        ctx.fillText(String(((v - 1) % 6) + 1), x + 36, y + 48);
      };
      drawDie(88, 100, da);
      drawDie(200, 100, db);
      if (st.phase === "ready") {
        ctx.fillStyle = WARN;
        ctx.font = "11px monospace";
        ctx.textAlign = "center";
        ctx.fillText("ROLL", W / 2, 200);
      }
      if (st.phase === "roll" && st.rollFrame > 40) {
        ctx.fillStyle = HI;
        ctx.fillText(`= ${st.a + st.b}`, W / 2, 200);
      }
      drawScanlines(ctx);
      drawHoldHint(ctx, !!this.pendingFinish);
      return;
    }

    if (st.kind === "high_low") {
      drawFrame(ctx, "HIGH · LOW", "1·high / 2·low · or tap");
      ctx.textAlign = "center";
      ctx.fillStyle = "#0a3020";
      roundRect(ctx, 100, 88, 120, 56, 6);
      ctx.fill();
      ctx.strokeStyle = FG;
      ctx.stroke();
      ctx.fillStyle = FG;
      ctx.font = "bold 36px monospace";
      ctx.fillText(rankLabel(st.first), 160, 128);
      if (st.phase === "guess") {
        ctx.fillStyle = DIM;
        roundRect(ctx, 48, 160, 96, 40, 6);
        roundRect(ctx, 176, 160, 96, 40, 6);
        ctx.fill();
        ctx.fillStyle = FG;
        ctx.font = "12px monospace";
        ctx.fillText("HIGH", 96, 182);
        ctx.fillText("LOW", 224, 182);
      } else {
        ctx.fillStyle = "#0a3020";
        roundRect(ctx, 100, 160, 120, 56, 6);
        ctx.fill();
        ctx.strokeStyle = HI;
        ctx.stroke();
        ctx.fillStyle = st.dealFrame > 15 ? FG : DIM;
        ctx.font = "bold 36px monospace";
        ctx.fillText(rankLabel(st.second), 160, 200);
      }
      drawScanlines(ctx);
      drawHoldHint(ctx, !!this.pendingFinish);
      return;
    }

    if (st.kind === "lottery") {
      drawFrame(ctx, "HAT DRAW", "Pick 1–6 · match the draw");
      for (let i = 0; i < 6; i++) {
        const x = 36 + i * 48;
        const on = st.pick === i + 1;
        ctx.fillStyle = on ? "#0a5030" : "#0a3020";
        roundRect(ctx, x, 130, 40, 36, 4);
        ctx.fill();
        ctx.strokeStyle = on ? HI : DIM;
        ctx.stroke();
        ctx.fillStyle = FG;
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "center";
        ctx.fillText(String(i + 1), x + 20, 152);
      }
      ctx.textAlign = "center";
      if (st.phase === "spin") {
        const show = st.spinFrame > 25;
        ctx.fillStyle = show ? HI : WARN;
        ctx.font = "bold 22px monospace";
        ctx.fillText(show ? `DRAW: ${st.draw}` : "…drawing…", W / 2, 200);
      }
      drawScanlines(ctx);
      drawHoldHint(ctx, !!this.pendingFinish);
      return;
    }

    if (st.kind === "knife") {
      drawFrame(ctx, "KNIFE TOSS", "SPACE or tap when the bar hits the chalk ring");
      ctx.fillStyle = "#0a3020";
      ctx.fillRect(40, 100, 240, 24);
      ctx.strokeStyle = DIM;
      ctx.strokeRect(40, 100, 240, 24);
      ctx.fillStyle = "rgba(0,255,120,0.25)";
      ctx.fillRect(40 + 96, 100, 48, 24);
      ctx.strokeStyle = HI;
      ctx.lineWidth = 2;
      ctx.strokeRect(40 + 96, 100, 48, 24);
      const x = 40 + (st.power / 100) * 240;
      ctx.fillStyle = WARN;
      ctx.fillRect(x - 2, 96, 4, 32);
      ctx.fillStyle = FG;
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(st.power)}`, W / 2, 210);
      drawScanlines(ctx);
      drawHoldHint(ctx, !!this.pendingFinish);
    }
  }
}
