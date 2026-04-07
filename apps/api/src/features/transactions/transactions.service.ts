import type { PrismaClient, Prisma } from "@prisma/client";
import {
  CreateTransactionInput,
  AddPaymentsInput,
  ListTransactionsQuery,
} from "./transactions.schema";
import { promotionsService } from "../promotions/promotions.service";
import { HTTPException } from "hono/http-exception";
import type { NotificationService } from "../../utils/notifications";
import { paymentReceiptEmail } from "@tmng/email-templates";

async function getOrgTaxRate(db: PrismaClient, organizationId: string): Promise<number> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { taxEnabled: true, taxRate: true },
  });
  if (!org || !org.taxEnabled) return 0;
  return org.taxRate / 100;
}

/** Transaction client from db.$transaction (for use in addPayments and webhook finalization). */
type TxClient = Prisma.TransactionClient;

export async function finalizeTransactionSideEffects(
  tx: TxClient,
  transactionId: string,
  updatedTransaction: { id: string; organizationId: string; branchId: string; queueEntryId: string | null; promoCode: string | null; loyaltyPointsUsed: number; customerId: string | null; items: Array<{ productId: string | null; quantity: number }> },
  notificationService?: NotificationService
) {
  if (!updatedTransaction) {
    console.error("Side-effect: updatedTransaction is missing, skipping side effects");
    return;
  }

  // Mark queue entry as PAID (non-critical)
  if (updatedTransaction.queueEntryId) {
    try {
      await tx.queueEntry.update({
        where: { id: updatedTransaction.queueEntryId },
        data: { status: "PAID", completedAt: new Date() },
      });
    } catch (e: any) {
      console.error("Side-effect: failed to update queue entry:", e.message);
    }
  }

  // Increment promo code usage
  if (updatedTransaction.promoCode && updatedTransaction.organizationId) {
    try {
      await tx.promoCode.update({
        where: { organizationId_code: { organizationId: updatedTransaction.organizationId, code: updatedTransaction.promoCode } },
        data: { usageCount: { increment: 1 } },
      });
    } catch (e: any) {
      console.error("Side-effect: failed to update promo code:", e.message);
    }
  }

  // Loyalty: redeem & earn via LoyaltyService (config-driven rates)
  try {
    const { LoyaltyService } = await import("../loyalty/loyalty.service");
    const { ConfigService } = await import("../config/config.service");
    const [earnRate, redeemRate] = await Promise.all([
      ConfigService.getNumericConfig(tx as unknown as PrismaClient, "POINTS_EARN_RATE", 10_000),
      ConfigService.getNumericConfig(tx as unknown as PrismaClient, "POINTS_REDEEM_RATE", 500),
    ]);
    const loyaltyRates = { earnRate, redeemRate };

    if (updatedTransaction.loyaltyPointsUsed > 0 && updatedTransaction.customerId) {
      const txRecord = await tx.transaction.findUnique({
        where: { id: transactionId },
        select: { netAmount: true },
      });
      await LoyaltyService.redeemPoints(
        tx,
        updatedTransaction.customerId,
        updatedTransaction.loyaltyPointsUsed,
        updatedTransaction.id,
        txRecord?.netAmount ?? 0,
        loyaltyRates,
      );
    }
    if (updatedTransaction.customerId) {
      const txRecord = await tx.transaction.findUnique({
        where: { id: transactionId },
        select: { netAmount: true },
      });
      const result = await LoyaltyService.earnPoints(
        tx,
        updatedTransaction.customerId,
        updatedTransaction.id,
        txRecord?.netAmount ?? 0,
        loyaltyRates,
      );
      if (result.pointsEarned > 0) {
        await tx.transaction.update({
          where: { id: updatedTransaction.id },
          data: { loyaltyPointsEarned: result.pointsEarned },
        });
      }
    }
  } catch (e: any) {
    console.error("Side-effect: loyalty processing failed:", e.message);
  }

  // Referral: complete referral if this is the referee's first completed transaction
  if (updatedTransaction.customerId) {
    try {
      const completedCount = await tx.transaction.count({
        where: { customerId: updatedTransaction.customerId, status: "COMPLETED" },
      });
      if (completedCount === 1) {
        const { ReferralService } = await import("../referrals/referrals.service");
        await ReferralService.completeReferral(tx, updatedTransaction.customerId);
      }
    } catch (e: any) {
      console.error("Side-effect: referral processing failed:", e.message);
    }
  }

  // Commission
  try {
    const { CommissionService } = await import("../commissions/commissions.service");
    await CommissionService.triggerOnPaid(tx, transactionId);
  } catch (e: any) {
    console.error("Side-effect: commission processing failed:", e.message);
  }

  // Inventory stock-out
  try {
    const { InventoryService } = await import("../inventory/inventory.service");
    for (const item of updatedTransaction.items) {
      if (item.productId && item.quantity > 0) {
        await InventoryService.recordStockOut(
          tx,
          updatedTransaction.branchId,
          item.productId,
          updatedTransaction.organizationId,
          item.quantity,
          `Transaction ${transactionId}`
        );
      }
    }
  } catch (e: any) {
    console.error("Side-effect: inventory stock-out failed:", e.message);
  }

  // Payment Receipt Email
  if (notificationService && updatedTransaction.customerId) {
    try {
      const db = tx as unknown as PrismaClient;
      const [branchInfo, pref, txDetails, customerUser] = await Promise.all([
        db.branch.findUnique({
          where: { id: updatedTransaction.branchId },
          select: { name: true, address: true, city: true, phone: true, email: true, imageUrl: true },
        }),
        db.notificationPreference.findUnique({ where: { userId: updatedTransaction.customerId } }),
        db.transaction.findUnique({
          where: { id: transactionId },
          include: { items: true, queueEntry: true },
        }),
        db.user.findUnique({
          where: { id: updatedTransaction.customerId },
          select: { firstName: true }
        })
      ]);

      // Legacy fallback: Send email if preference is missing (pref is null) or opt-out is false.
      const shouldSendEmail = branchInfo && (!pref || pref.emailOptOut === false) && txDetails;

      if (shouldSendEmail) {
        const customerName = customerUser?.firstName ?? "Customer";
        const emailItems = txDetails!.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.unitPrice,
          total: item.total,
        }));
        
        const { subject, html } = paymentReceiptEmail({
          customerName,
          branchName: branchInfo.name,
          currency: "IDR",
          paidAt: new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
          totalDue: txDetails!.totalDue,
          items: emailItems,
          branch: branchInfo,
        });
 
        await notificationService.sendEmail(updatedTransaction.customerId, subject, html);
      }
    } catch (e: any) {
      console.error("Side-effect: payment receipt email failed:", e.message);
    }
  }
}

/**
 * Internal helper to verify if a user is authorized to access a transaction.
 * Logic: (OWNS transaction) OR (OWNS original queue booking) OR (HAS TRANSACTION:read permission).
 */
async function verifyTransactionAccess(
  transaction: { customerId: string | null; queueEntry?: { customerId: string | null } | null },
  userId: string,
  permissions?: Map<string, { canRead: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean }>
) {
  // 1. Direct Ownership check (Real User matches)
  if (transaction.customerId && userId === transaction.customerId) return;

  // 2. Queue ownership check (Fallback: if user matches the booking creator/owner)
  if (transaction.queueEntry?.customerId && userId === transaction.queueEntry.customerId) {
    return;
  }

  // 3. Staff RBAC check
  if (permissions?.get("TRANSACTION")?.canRead) return;

  // 4. Forbidden
  console.warn(`[Auth] Access denied for user ${userId} to transaction ${transaction.customerId} (Queue owner: ${transaction.queueEntry?.customerId})`);
  throw new HTTPException(403, { message: "Forbidden" });
}

/**
 * Internal helper to generate a persistent receipt number.
 * Format: TX-YYYYMMDD-XXX
 */
async function generateTransactionReceiptNumber(db: TxClient, transaction: { id: string; branchId: string; createdAt?: Date }) {
  const date = transaction.createdAt || new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  
  // Count transactions in this branch for today created before or at the same time as this one
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const sequential = await db.transaction.count({
    where: {
      branchId: transaction.branchId,
      createdAt: { gte: startOfDay, lte: date },
      id: { lte: transaction.id },
      status: { in: ["COMPLETED", "VOIDED", "REFUNDED"] },
    },
  });

  return `TX-${dateStr}-${String(sequential).padStart(3, "0")}`;
}

export const TransactionService = {

  async createTransaction(db: PrismaClient, data: CreateTransactionInput, organizationId: string, scope?: string) {
    if (data.clientUuid) {
      const existing = await db.transaction.findUnique({
        where: { clientUuid: data.clientUuid },
      });
      if (existing) {
        return existing; // Idempotent
      }
    }

    const itemsGross = data.items.reduce((acc, item) => acc + (item.unitPrice * item.quantity - (item.discount || 0)), 0);
    const grossAmount = itemsGross;

    let promoDiscount = 0;
    if (data.promoCode) {
      const promoResult = await promotionsService.validatePromoCode(db, {
        code: data.promoCode,
        branchId: data.branchId,
        grossAmount: itemsGross,
        organizationId,
      });
      promoDiscount = promoResult.discountAmount;
    }

    let loyaltyDiscount = 0;
    if (data.loyaltyPointsUsed && data.customerId) {
      const loyaltyResult = await promotionsService.validateLoyaltyRedemption(
        db, 
        data.customerId, 
        data.loyaltyPointsUsed, 
        itemsGross - promoDiscount
      );
      loyaltyDiscount = loyaltyResult.discountAmount;
    }

    // 4. Manual Discount RBAC check
    if (data.discountAmount && data.discountAmount > 0) {
        const manualDiscountPercent = (data.discountAmount / itemsGross) * 100;
        if (scope === "CASHIER" && manualDiscountPercent > 10) {
            throw new HTTPException(403, { message: "Cashiers are limited to 10% manual discount. Request supervisor approval." });
        }
        // Supervisors, Managers, and Super Admins have no limit
    }

    const discountAmount = (data.discountAmount || 0) + promoDiscount + loyaltyDiscount;
    const taxRate = await getOrgTaxRate(db, organizationId);
    const taxAmount = (grossAmount - discountAmount) * taxRate;
    const netAmount = grossAmount - discountAmount + taxAmount;
    const tipAmount = data.tipAmount || 0;
    const totalDue = netAmount + tipAmount;

    // Build the transaction items
    const transactionItems = data.items.map((item) => {
      const rowTotal = item.unitPrice * item.quantity - (item.discount || 0);
      return {
        serviceId: item.serviceId,
        productId: item.productId,
        organizationId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        total: rowTotal,
        isAddOn: item.isAddOn || false,
      };
    });

    const transaction = await db.transaction.create({
      data: {
        organizationId,
        branchId: data.branchId,
        queueEntryId: data.queueEntryId,
        staffProfileId: data.staffProfileId,
        customerId: data.customerId,
        grossAmount,
        discountAmount,
        taxAmount,
        tipAmount,
        netAmount,
        totalDue,
        promoCode: data.promoCode,
        loyaltyPointsUsed: data.loyaltyPointsUsed,
        clientUuid: data.clientUuid,
        status: "PENDING",
        items: {
          create: transactionItems,
        },
      },
      include: {
        items: true,
      },
    });

    // Audit log for any discount application
    if (discountAmount > 0) {
      await db.auditLog.create({
        data: {
          organizationId,
          userId: data.customerId ?? null,
          branchId: data.branchId,
          action: "APPLY_DISCOUNT",
          entityType: "Transaction",
          entityId: transaction.id,
          details: {
            manualDiscount: data.discountAmount || 0,
            promoDiscount,
            loyaltyDiscount,
            promoCode: data.promoCode || null,
            loyaltyPointsUsed: data.loyaltyPointsUsed || 0,
            totalDiscount: discountAmount,
          },
        },
      });
    }

    return transaction;
  },

  async addPayments(db: PrismaClient, transactionId: string, data: AddPaymentsInput, notificationService?: NotificationService) {
    return await db.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) throw new Error("Transaction not found");
      if (transaction.status !== "PENDING") {
        throw new Error(`Transaction is already ${transaction.status}`);
      }

      const totalPaid = data.payments.reduce((acc, p) => acc + p.amount, 0);

      // We allow standard floating point comparison with a tiny epsilon
      if (Math.abs(totalPaid - transaction.totalDue) > 0.01) {
        throw new Error(`Payment mismatch: expected ${transaction.totalDue} got ${totalPaid}`);
      }

      const receiptNumber = await generateTransactionReceiptNumber(tx, transaction);

      await tx.payment.createMany({
        data: data.payments.map((p) => ({
          transactionId,
          organizationId: transaction.organizationId,
          method: p.method,
          amount: p.amount,
          reference: p.reference,
        })),
      });

      const updatedTransaction = await tx.transaction.update({
        where: { id: transactionId },
        data: { 
          status: "COMPLETED",
          receiptNumber,
        },
        include: {
          items: true,
          payments: true,
          queueEntry: true,
        },
      });

      await finalizeTransactionSideEffects(tx, transactionId, updatedTransaction, notificationService);
      return updatedTransaction;
    }, { timeout: 30000 });
  },

  async voidTransaction(db: PrismaClient, transactionId: string, userId: string, scope: string, reason: string) {
    return await db.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
        include: { items: true },
      });

      if (!transaction) throw new Error("Transaction not found");
      if (transaction.status === "VOIDED") throw new Error("Transaction is already voided");

      const { InventoryService } = await import("../inventory/inventory.service");
      for (const item of transaction.items) {
        if (item.productId && item.quantity > 0) {
          await InventoryService.recordVoidReversal(
            tx,
            transaction.branchId,
            item.productId,
            transaction.organizationId,
            item.quantity,
            `Void transaction ${transactionId}`
          );
        }
      }

      const updatedTransaction = await tx.transaction.update({
        where: { id: transactionId },
        data: { status: "VOIDED" },
      });

      await tx.auditLog.create({
        data: {
          organizationId: transaction.organizationId,
          userId,
          branchId: transaction.branchId,
          action: "VOID_TRANSACTION",
          entityType: "Transaction",
          entityId: transactionId,
          details: { reason },
        },
      });

      return updatedTransaction;
    }, { timeout: 30000 });
  },

  async refundTransaction(db: PrismaClient, transactionId: string, userId: string, reason: string) {
    return await db.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
        include: { items: true },
      });

      if (!transaction) throw new Error("Transaction not found");
      if (transaction.status === "REFUNDED") throw new Error("Transaction is already refunded");
      if (transaction.status !== "COMPLETED") throw new Error("Only completed transactions can be refunded");

      // 1. Reverse inventory stock for product line items
      const { InventoryService } = await import("../inventory/inventory.service");
      for (const item of transaction.items) {
        if (item.productId && item.quantity > 0) {
          await InventoryService.recordVoidReversal(
            tx,
            transaction.branchId,
            item.productId,
            transaction.organizationId,
            item.quantity,
            `Refund transaction ${transactionId}`
          );
        }
      }

      // 2. Reverse loyalty points earned
      if (transaction.loyaltyPointsEarned > 0 && transaction.customerId) {
        try {
          const { LoyaltyService } = await import("../loyalty/loyalty.service");
          await LoyaltyService.adjustPoints(
            tx as unknown as PrismaClient,
            transaction.customerId,
            -transaction.loyaltyPointsEarned,
            `Reversed: refund transaction ${transactionId}`,
          );
        } catch (e: any) {
          console.error("Refund side-effect: failed to reverse earned loyalty points:", e.message);
        }
      }

      // 3. Restore loyalty points that were redeemed
      if (transaction.loyaltyPointsUsed > 0 && transaction.customerId) {
        try {
          const { LoyaltyService } = await import("../loyalty/loyalty.service");
          await LoyaltyService.adjustPoints(
            tx as unknown as PrismaClient,
            transaction.customerId,
            transaction.loyaltyPointsUsed,
            `Restored: refund transaction ${transactionId}`,
          );
        } catch (e: any) {
          console.error("Refund side-effect: failed to restore redeemed loyalty points:", e.message);
        }
      }

      // 4. Update status
      const updatedTransaction = await tx.transaction.update({
        where: { id: transactionId },
        data: { status: "REFUNDED" },
      });

      // 5. Audit log
      await tx.auditLog.create({
        data: {
          organizationId: transaction.organizationId,
          userId,
          branchId: transaction.branchId,
          action: "REFUND_TRANSACTION",
          entityType: "Transaction",
          entityId: transactionId,
          details: {
            reason,
            refundedAmount: transaction.totalDue,
            loyaltyPointsEarnedReversed: transaction.loyaltyPointsEarned,
            loyaltyPointsUsedRestored: transaction.loyaltyPointsUsed,
          },
        },
      });

      return updatedTransaction;
    }, { timeout: 30000 });
  },

  async getDailySummary(db: PrismaClient, branchId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const transactions = await db.transaction.findMany({
      where: {
        branchId,
        status: "COMPLETED",
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        items: true,
        payments: true,
      },
    });

    let totalRevenue = 0;
    let totalServiceRevenue = 0;
    let totalProductRevenue = 0;
    let totalTips = 0;
    const paymentMethods: Record<string, number> = {
      CASH: 0,
      CARD: 0,
      QRIS: 0,
      DIGITAL_WALLET: 0,
    };

    for (const tx of transactions) {
      totalRevenue += tx.netAmount;
      totalTips += tx.tipAmount;

      for (const item of tx.items) {
        if (item.serviceId) totalServiceRevenue += item.total;
        if (item.productId) totalProductRevenue += item.total;
      }

      for (const payment of tx.payments) {
        paymentMethods[payment.method] = (paymentMethods[payment.method] || 0) + payment.amount;
      }
    }

    return {
      count: transactions.length,
      totalRevenue,
      totalServiceRevenue,
      totalProductRevenue,
      totalTips,
      paymentMethods,
    };
  },

  async listTransactions(db: PrismaClient, query: ListTransactionsQuery) {
    const where: any = { branchId: query.branchId };

    if (query.dateFrom && query.dateTo) {
      where.createdAt = {
        gte: new Date(query.dateFrom),
        lte: new Date(query.dateTo),
      };
    } else if (query.dateFrom) {
      const gte = new Date(query.dateFrom);
      gte.setHours(0, 0, 0, 0);
      const lt = new Date(gte);
      lt.setDate(lt.getDate() + 1);
      where.createdAt = { gte, lt };
    }

    if (query.status) where.status = query.status;
    if (query.staffProfileId) where.staffProfileId = query.staffProfileId;
    if (query.queueEntryId) where.queueEntryId = query.queueEntryId;

    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      db.transaction.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: "desc" },
        include: {
          items: true,
          payments: true,
          queueEntry: true,
        },
      }),
      db.transaction.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  },

  /**
   * Finalize a PENDING transaction (mark COMPLETED and run side effects). Used by payment webhook when gateway reports PAID.
   */
  async finalizeTransactionOnPaid(db: PrismaClient, transactionId: string, notificationService?: NotificationService) {
    return db.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
        include: { items: true },
      });
      if (!transaction || transaction.status !== "PENDING") return null;

      const receiptNumber = await generateTransactionReceiptNumber(tx, transaction);

      const updatedTransaction = await tx.transaction.update({
        where: { id: transactionId },
        data: { 
          status: "COMPLETED",
          receiptNumber,
        },
        include: { items: true, payments: true },
      });
      await finalizeTransactionSideEffects(tx, transactionId, updatedTransaction, notificationService);
      return updatedTransaction;
    }, { timeout: 30000 });
  },

  async getTransactionById(
    db: PrismaClient,
    id: string,
    userId: string,
    permissions?: Map<string, { canRead: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean }>
  ) {
    const tx = await db.transaction.findUnique({
      where: { id },
      include: {
        items: {
          include: { service: true, product: true },
        },
        payments: true,
        queueEntry: true,
        branch: true,
      },
    });

    if (!tx) throw new HTTPException(404, { message: "Transaction not found" });

    // Enforce access control
    await verifyTransactionAccess(tx, userId, permissions);

    return tx;
  },

  async getReceiptData(
    db: PrismaClient,
    id: string,
    userId: string,
    permissions?: Map<string, { canRead: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean }>
  ) {
    const tx = await db.transaction.findUnique({
      where: { id },
      include: {
        items: true,
        payments: true,
        branch: true,
        queueEntry: {
          include: {
            staff: {
              include: { user: true },
            },
          },
        },
      },
    });

    if (!tx) throw new HTTPException(404, { message: "Transaction not found" });

    // Enforce access control
    await verifyTransactionAccess(tx, userId, permissions);

    const date = new Date(tx.createdAt);

    // PERFORMANCE OPTIMIZATION: Use the pre-calculated receiptNumber from the DB.
    // If for any reason it's missing (e.g. legacy data), generate it on-the-fly and save it.
    let receiptNumber = (tx as any).receiptNumber as string | null;
    if (!receiptNumber) {
        console.info(`Lazy-generating missing receipt number for transaction ${id}`);
        receiptNumber = await generateTransactionReceiptNumber(db as unknown as TxClient, tx);
        await db.transaction.update({
            where: { id },
            data: { receiptNumber }
        });
    }

    const subtotal = tx.grossAmount;
    const discountTotal = tx.discountAmount;
    const tax = tx.taxAmount;
    const tip = tx.tipAmount;
    const grandTotal = tx.netAmount + tip;

    const user = tx.queueEntry?.staff?.user as { firstName?: string; lastName?: string } | undefined;
    const staffName =
      user != null
        ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || null
        : null;

    return {
      receiptNumber,
      date: date.toISOString(),
      branchId: tx.branchId,
      branchName: tx.branch.name,
      branchAddress: tx.branch.address ?? "",
      cashierName: "—",
      staffProfileId: tx.queueEntry?.staff?.id ?? null,
      staffName,
      queueEntryId: tx.queueEntryId ?? null,
      items: tx.items.map((i) => ({
        name: i.name,
        qty: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount,
        total: i.total,
      })),
      subtotal,
      discountTotal,
      tax,
      tip,
      grandTotal,
      payments: tx.payments.map((p) => ({ method: p.method, amount: p.amount })),
      loyaltyPointsEarned: tx.loyaltyPointsEarned ?? 0,
    };
  },
};
