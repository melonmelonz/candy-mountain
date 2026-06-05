import links from "../../links.json";

export interface Link { url: string; title: string; blurb?: string; addedBy?: string; }

export function linkForCycle(index: number): Link | undefined {
  const list = links as Link[];
  if (list.length === 0) return undefined;
  const n = list.length;
  return list[((index % n) + n) % n];
}
