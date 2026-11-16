import "server-only";

import { MongoClient, type Db } from "mongodb";

/**
 * Conexão com o MongoDB da King's Newsletter, somente leitura.
 *
 * O portal lê legis_items, legis_events e radar_items (ver collections.ts).
 * Quem grava é o kings-worker; a única escrita fora dele é o painel admin da
 * newsletter, e só no campo `explicacao`. Configure MONGODB_URI com um usuário
 * que tenha apenas permissão de leitura nessas coleções.
 *
 * Sem MONGODB_URI as páginas mostram o estado vazio, o que permite o build da
 * CI sem segredos.
 */

const globalForMongo = globalThis as unknown as {
  __kingsLegisMongo?: Promise<MongoClient>;
};

export function isDbConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI não definida.");

  if (!globalForMongo.__kingsLegisMongo) {
    const client = new MongoClient(uri, {
      appName: "kings-legis",
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8_000,
      readPreference: "secondaryPreferred",
    });
    globalForMongo.__kingsLegisMongo = client.connect().catch((error) => {
      // Permite nova tentativa na próxima requisição.
      globalForMongo.__kingsLegisMongo = undefined;
      throw error;
    });
  }
  return globalForMongo.__kingsLegisMongo;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(process.env.MONGODB_DB || undefined);
}
