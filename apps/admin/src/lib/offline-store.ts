import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "tmng-admin-offline";
const STORE = "transactions";

export type OfflineTransaction = {
  clientUuid: string;
  payload: Record<string, unknown>;
  status: "PENDING_SYNC" | "SYNCING" | "SYNCED" | "FAILED";
  createdAt: number;
  error?: string;
};

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, { upgrade: (database) => database.createObjectStore(STORE, { keyPath: "clientUuid" }) });
  }
  return dbPromise;
}

export async function saveOfflineTransaction(tx: OfflineTransaction): Promise<void> {
  const db = await getDB();
  await db.put(STORE, tx);
}

export async function getAllByStatus(status: OfflineTransaction["status"]): Promise<OfflineTransaction[]> {
  const db = await getDB();
  const all = await db.getAll(STORE);
  return all.filter((t) => t.status === status);
}

export async function updateStatus(clientUuid: string, status: OfflineTransaction["status"], error?: string): Promise<void> {
  const db = await getDB();
  const tx = await db.get(STORE, clientUuid);
  if (tx) {
    tx.status = status;
    if (error) tx.error = error;
    await db.put(STORE, tx);
  }
}
