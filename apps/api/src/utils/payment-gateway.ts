/**
 * Payment gateway adapter interface.
 * Swappable implementation (e.g. Xendit) for QRIS/Card. CASH bypasses the adapter.
 */

export interface ChargeRequest {
  amount: number;
  method: "QRIS" | "CARD";
  referenceId: string;
  description: string;
  customerEmail?: string;
}

export interface ChargeResponse {
  chargeId: string;
  status: "PENDING" | "PAID" | "FAILED";
  paymentUrl?: string;
  qrString?: string;
  expiresAt?: string;
}

export interface PaymentGatewayAdapter {
  createCharge(req: ChargeRequest): Promise<ChargeResponse>;
  checkStatus(chargeId: string): Promise<{ status: "PENDING" | "PAID" | "FAILED" }>;
}
