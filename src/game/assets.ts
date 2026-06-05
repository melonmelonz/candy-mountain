// The drifter roster. Index lines up with Cosmetics.sprite. `tintable` controls
// whether the hue palette-swap is applied: the original drifter is near-monochrome
// so hue-tinting gives it variety, but the authored girly sheets already carry
// their own colors, so tinting would flatten them — they render as-is.
export interface SheetDef { src: string; tintable: boolean; }

export const SHEETS: SheetDef[] = [
  { src: "/sprites/drifter.png", tintable: true },
  { src: "/sprites/blossom.png", tintable: false },
  { src: "/sprites/lilac.png", tintable: false },
];

export interface Assets {
  drifters: HTMLImageElement[]; // parallel to SHEETS
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

let cached: Promise<Assets> | null = null;

export function loadAssets(): Promise<Assets> {
  if (!cached) {
    cached = (async () => {
      // The base drifter (index 0) must load; the rest fall back to it if their
      // sheet is missing, so a 404 on one roster entry never blanks the game.
      const base = await loadImage(SHEETS[0].src);
      const rest = await Promise.all(
        SHEETS.slice(1).map((s) => loadImage(s.src).catch(() => base)),
      );
      return { drifters: [base, ...rest] };
    })();
  }
  return cached;
}
