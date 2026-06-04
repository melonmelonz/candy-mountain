export interface InputState { up: boolean; down: boolean; left: boolean; right: boolean; jump: boolean; }

export function createInput(target: Window = window): { state: InputState; dispose: () => void } {
  const state: InputState = { up: false, down: false, left: false, right: false, jump: false };
  const map: Record<string, keyof InputState> = {
    KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down",
    KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right", Space: "jump",
  };
  const down = (e: KeyboardEvent) => { const k = map[e.code]; if (k) { state[k] = true; e.preventDefault(); } };
  const up = (e: KeyboardEvent) => { const k = map[e.code]; if (k) { state[k] = false; e.preventDefault(); } };
  target.addEventListener("keydown", down);
  target.addEventListener("keyup", up);
  return { state, dispose: () => { target.removeEventListener("keydown", down); target.removeEventListener("keyup", up); } };
}
