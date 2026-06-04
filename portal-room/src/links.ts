import links from "../../links.json";
import { dailyIndex } from "../../src/game/dailypick";

export interface Link { url: string; title: string; blurb?: string; addedBy?: string; }

export function todaysLink(dayId: string): Link | undefined {
  const list = links as Link[];
  if (list.length === 0) return undefined;
  return list[dailyIndex(dayId, list.length)];
}
