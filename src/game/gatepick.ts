// The 6 daily-rotating warpgate ids, in canonical order (index 0..5).
export const GATE_IDS: string[] = [
  "d371f1dc-b42f-4028-8cdb-35c6943e666e",
  "219a17cd-640b-46da-9c9e-0bbebcf170b5",
  "00556895-076a-4ca7-9c7f-1fda8fc0fcb5",
  "0c074dde-67c6-4907-8ae7-cc927e2a453a",
  "cde806b2-abef-4854-aaea-605fa7347dec",
  "cb9c27af-7a4f-4c87-ad25-4a8267ed15a8",
];

// Negative-safe modulo wrap.
export function gateForCycle(index: number): string {
  const n = GATE_IDS.length;
  return GATE_IDS[((index % n) + n) % n];
}
