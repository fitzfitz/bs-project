import type { PrismaClient } from "@prisma/client";
import type {
  AddEntryInput,
} from "./cash-drawer.schema";

export const CashDrawerService = {
  async openSession(
    db: PrismaClient,
    branchId: string,
    userId: string,
    organizationId: string,
    openingBalance: number
  ) {
    const existing = await db.cashDrawerSession.findFirst({
      where: { branchId, status: "OPEN" },
    });
    if (existing) {
      throw new Error("A cash drawer session is already open for this branch");
    }

    return db.cashDrawerSession.create({
      data: {
        organizationId,
        branchId,
        openedById: userId,
        openingBalance,
        status: "OPEN",
      },
      include: {
        branch: true,
        openedBy: { select: { id: true, firstName: true, lastName: true } },
        entries: true,
      },
    });
  },

  async getCurrentSession(db: PrismaClient, branchId: string) {
    return db.cashDrawerSession.findFirst({
      where: { branchId, status: "OPEN" },
      include: {
        branch: true,
        openedBy: { select: { id: true, firstName: true, lastName: true } },
        entries: { orderBy: { createdAt: "asc" } },
      },
    });
  },

  async addEntry(
    db: PrismaClient,
    sessionId: string,
    type: AddEntryInput["type"],
    amount: number,
    reference?: string
  ) {
    const session = await db.cashDrawerSession.findUnique({
      where: { id: sessionId },
      select: { status: true, organizationId: true },
    });
    if (!session) throw new Error("Session not found");
    if (session.status !== "OPEN") {
      throw new Error("Cannot add entry to a closed session");
    }

    return db.cashDrawerEntry.create({
      data: { sessionId, organizationId: session.organizationId, type, amount, reference },
    });
  },

  async closeSession(
    db: PrismaClient,
    sessionId: string,
    closingBalance: number,
    notes?: string
  ) {
    const session = await db.cashDrawerSession.findUnique({
      where: { id: sessionId },
      include: { entries: true },
    });
    if (!session) throw new Error("Session not found");
    if (session.status !== "OPEN") {
      throw new Error("Session is already closed");
    }

    const entriesSum = session.entries.reduce((acc, e) => acc + e.amount, 0);
    const expectedBalance = session.openingBalance + entriesSum;
    const discrepancy = closingBalance - expectedBalance;

    return db.cashDrawerSession.update({
      where: { id: sessionId },
      data: {
        closingBalance,
        expectedBalance,
        discrepancy,
        status: "CLOSED",
        closedAt: new Date(),
        notes,
      },
      include: {
        branch: true,
        openedBy: { select: { id: true, firstName: true, lastName: true } },
        entries: { orderBy: { createdAt: "asc" } },
      },
    });
  },
};
