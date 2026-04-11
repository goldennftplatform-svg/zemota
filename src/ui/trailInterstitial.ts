import "./trailInterstitial.css";

const DURATION_MS_MIN = 2000;
const DURATION_MS_MAX = 2800;

const BRANDS = ["WAGON", "THE TRAIL", "OVERLAND"] as const;

const SCENES: { id: string; ascii: string; tag: string }[] = [
  {
    id: "oxen",
    ascii: `
     (____)
    (o  o)__
   /|     o\\
  / |      \\
 *  ||----||  *
    ~~    ~~`.trim(),
    tag: "Oxen hold the line.",
  },
  {
    id: "river",
    ascii: `
  ~~~~~~~~~~~~
 ~  ~  ~  ~  ~ ~
~  ≈  ≈  ≈  ≈  ~
 ~  ~  ~  ~  ~ ~
  ~~~~~~~~~~~~`.trim(),
    tag: "Cold water, loud crossing.",
  },
  {
    id: "plains",
    ascii: `
 .  ·    .    ·   .
   ·     ___     ·
  ·    ./   \\.    .
 ·     |     |     ·
.  ·    \\___/  ·    .`.trim(),
    tag: "Miles of sky and sage.",
  },
  {
    id: "wagon",
    ascii: `
      ___________
     |  [====]  |
  ___|___||____|___
 /   o         o   \\
/___________________\\
      W E S T`.trim(),
    tag: "Canvas, iron, dust.",
  },
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function durationMs(): number {
  return DURATION_MS_MIN + Math.floor(Math.random() * (DURATION_MS_MAX - DURATION_MS_MIN));
}

/**
 * Full-screen CRT-style “commercial” between travel days. Resolves when done.
 */
export function showTrailInterstitial(): Promise<void> {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = "emota-trail-interstitial";
    el.setAttribute("role", "presentation");
    el.innerHTML = `
      <div class="emota-trail-interstitial__scan" aria-hidden="true"></div>
      <div class="emota-trail-interstitial__inner">
        <div class="emota-trail-interstitial__brand">${pick(BRANDS)}</div>
        <pre class="emota-trail-interstitial__ascii"></pre>
        <p class="emota-trail-interstitial__tag"></p>
      </div>
    `;
    const scene = pick(SCENES);
    const pre = el.querySelector<HTMLPreElement>(".emota-trail-interstitial__ascii");
    const tag = el.querySelector<HTMLParagraphElement>(".emota-trail-interstitial__tag");
    if (pre) pre.textContent = scene.ascii;
    if (tag) tag.textContent = scene.tag;
    document.body.appendChild(el);

    const ms = durationMs();

    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);

    window.setTimeout(() => {
      el.classList.add("emota-trail-interstitial--out");
      window.removeEventListener("keydown", onKey, true);
      window.setTimeout(() => {
        el.remove();
        resolve();
      }, 420);
    }, ms);
  });
}
