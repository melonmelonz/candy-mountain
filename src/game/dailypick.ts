export function dailyIndex(dayId: string, n: number): number {
  if (n <= 1) return 0;
  const salted = `candy-mountain::${dayId}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < salted.length; i++) {
    h ^= salted.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % n;
}
