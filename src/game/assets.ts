export interface Assets {
  drifter: HTMLImageElement;
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
    cached = (async () => ({ drifter: await loadImage("/sprites/drifter.png") }))();
  }
  return cached;
}
