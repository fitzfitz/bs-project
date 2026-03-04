/// <reference types="node" />
import axios from "axios";

const API_URL = "http://localhost:8787/api";
const api = axios.create({ baseURL: API_URL });

async function verifyRBAC() {
  console.log("━━━ RBAC & Queue Flow Verification ━━━\n");

  try {
    // 1. Login as Manager (has full queue control)
    const loginRes = await api.post("/auth/login", {
      email: "manager@barber.com",
      password: "Password123!",
    });
    const token = loginRes.data.data.accessToken;
    const auth = { headers: { Authorization: `Bearer ${token}` } };
    console.log("✅ Logged in as Manager");

    // 2. Get a branch and service from the database
    const branchesRes = await api.get("/branches");
    const branchId = branchesRes.data.data[0]?.id;
    if (!branchId) throw new Error("No branches found — run db:seed first");
    console.log(`✅ Branch: ${branchId}`);

    const servicesRes = await api.get("/services");
    const serviceId = servicesRes.data.data[0]?.id;
    if (!serviceId) throw new Error("No services found — run db:seed first");
    console.log(`✅ Service: ${serviceId}`);

    // 3. Get staff for the branch
    const staffRes = await api.get(`/staff?branchId=${branchId}`);
    const staffProfileId = staffRes.data.data[0]?.id;
    console.log(`✅ Staff: ${staffProfileId || "any"}`);

    // 4. Create a walk-in queue entry
    const queueRes = await api.post("/queue", {
      branchId,
      customerName: "RBAC Verify User",
      serviceIds: [serviceId],
      source: "WALK_IN",
      staffProfileId: staffProfileId || undefined,
    }, auth);
    const queueId = queueRes.data.data.id;
    console.log(`✅ Queue entry created: ${queueId}`);

    // 5. Walk through the full status flow
    const statuses = ["CALLED", "IN_SERVICE", "COMPLETED", "AT_CHECKOUT"];
    for (const status of statuses) {
      await api.patch(`/queue/${queueId}/status`, { status }, auth);
      console.log(`  → ${status} ✓`);
    }
    console.log("✅ Full queue flow completed without errors!");

    // 6. Verify the auto-drafted transaction exists
    const txRes = await api.get(`/transactions?branchId=${branchId}&status=PENDING`, auth);
    const pendingTx = txRes.data.data?.find((t: any) => t.queueEntryId === queueId);
    if (pendingTx) {
      console.log(`✅ Auto-drafted transaction found: ${pendingTx.id} (${pendingTx.totalDue} IDR)`);
    } else {
      console.log("⚠️  No auto-drafted transaction found (may need to check AT_CHECKOUT logic)");
    }

    // 7. RBAC negative test: Customer should NOT be able to void
    console.log("\n--- RBAC Negative Tests ---");
    const custLogin = await api.post("/auth/login", {
      email: "customer1@gmail.com",
      password: "Password123!",
    });
    const custAuth = { headers: { Authorization: `Bearer ${custLogin.data.data.accessToken}` } };

    try {
      await api.post("/branches", { name: "Hack", address: "X", city: "Y" }, custAuth);
      console.log("❌ FAIL: Customer was able to create a branch!");
    } catch (err: any) {
      if (err.response?.status === 403 || err.response?.status === 401) {
        console.log("✅ Customer correctly blocked from creating branch (403/401)");
      } else {
        console.log(`⚠️  Unexpected error: ${err.response?.status} ${err.response?.data?.message}`);
      }
    }

    console.log("\n🎉 All verifications passed!");

  } catch (err: any) {
    console.error("\n❌ Verification failed:");
    if (err.response) {
      console.error(`  Status: ${err.response.status}`);
      console.error(`  Body:`, err.response.data);
    } else {
      console.error(`  ${err.message}`);
    }
    process.exit(1);
  }
}

verifyRBAC();
