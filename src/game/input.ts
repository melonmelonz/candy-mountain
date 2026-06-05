export interface InputState { up: boolean; down: boolean; left: boolean; right: boolean; jump: boolean; }

export function createInput(target: Window = window): { state: InputState; setPaused: (p: boolean) => void; dispose: () => void } {
  const state: InputState = { up: false, down: false, left: false, right: false, jump: false };
  let paused = false;
  const map: Record<string, keyof InputState> = {
    KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down",
    KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right", Space: "jump",
  };
  const clear = () => { state.up = state.down = state.left = state.right = state.jump = false; };
  const down = (e: KeyboardEvent) => { if (paused) return; const k = map[e.code]; if (k) { state[k] = true; e.preventDefault(); } };
  const up = (e: KeyboardEvent) => { if (paused) return; const k = map[e.code]; if (k) { state[k] = false; e.preventDefault(); } };
  const setPaused = (p: boolean) => { paused = p; if (p) clear(); }; // halt movement while composing chat
  target.addEventListener("keydown", down);
  target.addEventListener("keyup", up);
  return { state, setPaused, dispose: () => { target.removeEventListener("keydown", down); target.removeEventListener("keyup", up); } };
}
