import links from "../../links.json";
import { dailyIndex } from "../../src/game/dailypick";

export interface Link { url: string; title: string; blurb?: string; addedBy?: string; }

export function todaysLink(dayId: string): Link {
  const list = links as Link[];
  return list[dailyIndex(dayId, list.length)];
}
