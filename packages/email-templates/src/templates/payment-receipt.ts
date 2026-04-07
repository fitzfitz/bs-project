import type { BranchInfo, EmailOutput, ReceiptLineItem } from "../types";
import { wrapInLayout } from "../layout";

export interface PaymentReceiptData {
  customerName: string;
  branchName: string;
  items: ReceiptLineItem[];
  totalDue: number;
  currency: string;
  paidAt: string;
  branch: BranchInfo;
}

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-US")}`;
}

export function paymentReceiptEmail(data: PaymentReceiptData): EmailOutput {
  const itemRows = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#374151">${item.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:#374151">${item.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#374151">${formatAmount(item.price, data.currency)}</td>
      </tr>`,
    )
    .join("");

  const body = `
    <h2 style="margin:0 0 16px;color:#1a1a2e">Payment Receipt 🧾</h2>
    <p style="margin:0 0 8px;color:#374151">Hi ${data.customerName},</p>
    <p style="margin:0 0 16px;color:#374151">Thank you for your visit! Here's your receipt:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#f9fafb">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb">Item</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb">Qty</th>
        <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb">Price</th>
      </tr>
      ${itemRows}
      <tr>
        <td colspan="2" style="padding:12px;text-align:right;font-weight:bold;color:#1a1a2e;border-top:2px solid #1a1a2e">Total</td>
        <td style="padding:12px;text-align:right;font-weight:bold;font-size:16px;color:#1a1a2e;border-top:2px solid #1a1a2e">${formatAmount(data.totalDue, data.currency)}</td>
      </tr>
    </table>
    <p style="color:#6b7280;font-size:13px;margin:8px 0 0">Paid at: ${data.paidAt}</p>
    <p style="color:#6b7280;font-size:13px;margin:4px 0 0">Branch: ${data.branchName}</p>
    <p style="color:#6b7280;font-size:14px;margin:16px 0 0">Thank you for choosing us! We look forward to your next visit.</p>
  `;

  return {
    subject: `Your Receipt from ${data.branch.name}`,
    html: wrapInLayout(data.branch, body),
  };
}
