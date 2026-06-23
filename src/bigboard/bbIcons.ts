/** Tiny crisp SVG icons for projector / TV wall (no emoji — reads at distance). */

const SVG_BASE = 'class="bb-ico" viewBox="0 0 16 16" aria-hidden="true" focusable="false"';

export function bbFeedIcon(kind: string): string {
  switch (kind) {
    case "death":
      return `<svg ${SVG_BASE}><circle cx="8" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 11h6M6 13h4" stroke="currentColor" stroke-width="1.3"/></svg>`;
    case "victory":
      return `<svg ${SVG_BASE}><path d="M8 2l1.6 3.2 3.6.5-2.6 2.5.6 3.6L8 10.2 4.8 12l.6-3.6L3 5.7l3.6-.5z" fill="currentColor"/></svg>`;
    case "wipeout":
      return `<svg ${SVG_BASE}><path d="M3 11h10M4 8l8-2M5 13l6-1" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="5" cy="13" r="1.2" fill="currentColor"/><circle cx="11" cy="12" r="1.2" fill="currentColor"/></svg>`;
    case "river":
      return `<svg ${SVG_BASE}><path d="M2 6c2 2 4-2 6 0s4-2 6 0M2 10c2 2 4-2 6 0s4-2 6 0" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;
    case "milestone":
      return `<svg ${SVG_BASE}><path d="M4 14V4l4-2 4 2v10" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M8 6v5" stroke="currentColor" stroke-width="1.3"/></svg>`;
    default:
      return `<svg ${SVG_BASE}><circle cx="8" cy="8" r="2.5" fill="currentColor"/></svg>`;
  }
}

export function bbLiveIcon(): string {
  return `<svg ${SVG_BASE}><circle cx="8" cy="8" r="3" fill="currentColor"/></svg>`;
}

export function bbTrophyIcon(): string {
  return `<svg ${SVG_BASE}><path d="M5 3h6v3c0 2-1.2 3.5-3 4v2h2v1H5v-1h2v-2c-1.8-.5-3-2-3-4V3z" fill="currentColor"/></svg>`;
}
