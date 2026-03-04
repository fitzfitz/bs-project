import type { PaymentGatewayAdapter, ChargeRequest, ChargeResponse } from "./payment-gateway";

const XENDIT_BASE = "https://api.xendit.co";

export class XenditAdapter implements PaymentGatewayAdapter {
  constructor(private secretKey: string) {}

  private authHeader(): string {
    const encoded = typeof btoa !== "undefined"
      ? btoa(`${this.secretKey}:`)
      : Buffer.from(`${this.secretKey}:`, "utf-8").toString("base64");
    return `Basic ${encoded}`;
  }

  async createCharge(req: ChargeRequest): Promise<ChargeResponse> {
    const body: Record<string, unknown> = {
      external_id: req.referenceId,
      amount: req.amount,
      currency: "IDR",
      description: req.description || `Payment ${req.referenceId}`,
    };
    if (req.customerEmail) {
      body.customer = {
        email: req.customerEmail,
        given_names: "Customer",
        surname: "",
      };
    }
    const res = await fetch(`${XENDIT_BASE}/v2/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.authHeader(),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Xendit createCharge failed: ${res.status} ${err}`);
    }
    const data = (await res.json()) as {
      id: string;
      status: string;
      invoice_url?: string;
      expiry_date?: string;
    };
    const status = data.status === "PAID" ? "PAID" : data.status === "EXPIRED" ? "FAILED" : "PENDING";
    return {
      chargeId: data.id,
      status: status as "PENDING" | "PAID" | "FAILED",
      paymentUrl: data.invoice_url,
      expiresAt: data.expiry_date,
    };
  }

  async checkStatus(chargeId: string): Promise<{ status: "PENDING" | "PAID" | "FAILED" }> {
    const res = await fetch(`${XENDIT_BASE}/invoices/${chargeId}`, {
      headers: { Authorization: this.authHeader() },
    });
    if (!res.ok) {
      throw new Error(`Xendit checkStatus failed: ${res.status}`);
    }
    const data = (await res.json()) as { status: string };
    const status = data.status === "PAID" ? "PAID" : data.status === "EXPIRED" ? "FAILED" : "PENDING";
    return { status: status as "PENDING" | "PAID" | "FAILED" };
  }
}
