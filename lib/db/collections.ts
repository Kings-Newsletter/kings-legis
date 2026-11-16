import "server-only";

import type { Collection } from "mongodb";

import type { LegisEvent, LegisItem, RadarItem } from "@/lib/types";

import { getDb } from "./mongo";

/** Nomes fixos: os mesmos usados pelo kings-worker. */
export const COLLECTIONS = {
  legisItems: "legis_items",
  legisEvents: "legis_events",
  radarItems: "radar_items",
} as const;

export async function collections(): Promise<{
  legisItems: Collection<LegisItem>;
  legisEvents: Collection<LegisEvent>;
  radarItems: Collection<RadarItem>;
}> {
  const db = await getDb();
  return {
    legisItems: db.collection<LegisItem>(COLLECTIONS.legisItems),
    legisEvents: db.collection<LegisEvent>(COLLECTIONS.legisEvents),
    radarItems: db.collection<RadarItem>(COLLECTIONS.radarItems),
  };
}
