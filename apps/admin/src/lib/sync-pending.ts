import { getAllByStatus, updateStatus } from "./offline-store";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787/api";

async function syncTransaction(tx: { clientUuid: string; payload: Record<string, unknown> }, getToken: () => string | null): Promise<void> {
  await updateStatus(tx.clientUuid, "SYNCING");
  try {
    const token = getToken();
    const orgSlug = import.meta.env.VITE_ORG_SLUG;
    const res = await fetch(`${API_URL}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(orgSlug ? { "X-Org-Slug": orgSlug } : {}),
      },
      body: JSON.stringify({ ...tx.payload, clientUuid: tx.clientUuid }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      await updateStatus(tx.clientUuid, "SYNCED");
    } else if (res.status === 409) {
      await updateStatus(tx.clientUuid, "SYNCED");
    } else {
      await updateStatus(tx.clientUuid, "FAILED", json.message || "Sync failed");
    }
  } catch (err) {
    await updateStatus(tx.clientUuid, "FAILED", err instanceof Error ? err.message : "Network error");
  }
}

export async function syncPendingTransactions(getToken: () => string | null): Promise<void> {
  const pending = await getAllByStatus("PENDING_SYNC");
  pending.sort((a, b) => a.createdAt - b.createdAt);
  for (const tx of pending) {
    await syncTransaction(tx, getToken);
  }
}

export async function retryFailedTransactions(getToken: () => string | null): Promise<void> {
  const failed = await getAllByStatus("FAILED");
  for (const tx of failed) {
    await updateStatus(tx.clientUuid, "PENDING_SYNC");
    await syncTransaction(tx, getToken);
  }
}
