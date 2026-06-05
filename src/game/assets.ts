import type { RosterManifest, GateManifest } from "./roster";

export interface Assets {
  roster: RosterManifest;
  gates: GateManifest;
  /** Every atlas PNG referenced by the roster + gate manifests, keyed by the
   *  manifest `file` string (e.g. "medusa-voidborne/rotations.png"). */
  images: Map<string, HTMLImageElement>;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

// 1x1 transparent PNG as a data URL for use as a placeholder on load failure.
const TRANSPARENT_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

let placeholder: HTMLImageElement | null = null;
function getPlaceholder(): Promise<HTMLImageElement> {
  if (!placeholder) {
    placeholder = new Image();
    placeholder.src = TRANSPARENT_PNG;
  }
  return Promise.resolve(placeholder);
}

let cached: Promise<Assets> | null = null;

export function loadAssets(): Promise<Assets> {
  if (!cached) {
    cached = (async () => {
      // Roster + gate manifests.
      const [rosterManifest, gateManifest] = await Promise.all([
        fetch("/sprites/roster/manifest.json").then(
          (r) => r.json() as Promise<RosterManifest>,
        ),
        fetch("/sprites/gates/manifest.json").then(
          (r) => r.json() as Promise<GateManifest>,
        ),
      ]);

      // Collect every unique atlas file path referenced by the manifests.
      const rosterFiles = new Set<string>();
      for (const char of rosterManifest.characters) {
        rosterFiles.add(char.rotations.file);
        for (const state of Object.values(char.states)) {
          rosterFiles.add(state.file);
        }
      }

      const gateFiles = new Set<string>();
      for (const gate of gateManifest.gates) {
        gateFiles.add(gate.file);
      }

      // Load all atlas PNGs; on error insert the transparent placeholder so a
      // single bad asset never blanks the game.
      const ph = await getPlaceholder();
      const images = new Map<string, HTMLImageElement>();

      await Promise.all([
        ...[...rosterFiles].map(async (file) => {
          const img = await loadImage(`/sprites/roster/${file}`).catch((err) => {
            console.warn(`[assets] failed to load roster atlas: ${file}`, err);
            return ph;
          });
          images.set(file, img);
        }),
        ...[...gateFiles].map(async (file) => {
          const img = await loadImage(`/sprites/gates/${file}`).catch((err) => {
            console.warn(`[assets] failed to load gate atlas: ${file}`, err);
            return ph;
          });
          images.set(file, img);
        }),
      ]);

      return {
        roster: rosterManifest,
        gates: gateManifest,
        images,
      };
    })();
  }
  return cached;
}
