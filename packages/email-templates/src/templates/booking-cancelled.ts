import type { BranchInfo, EmailOutput } from "../types";
import { wrapInLayout } from "../layout";

export interface BookingCancelledData {
  customerName: string;
  serviceName: string;
  scheduledAt: string;
  branch: BranchInfo;
}

export function bookingCancelledEmail(data: BookingCancelledData): EmailOutput {
  const body = `
    <h2 style="margin:0 0 16px;color:#dc2626">Booking Cancelled</h2>
    <p style="margin:0 0 8px;color:#374151">Hi ${data.customerName},</p>
    <p style="margin:0 0 16px;color:#374151">Your booking has been cancelled. Here were the details:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280">Service</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:bold;color:#1a1a2e">${data.serviceName}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280">Branch</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:bold;color:#1a1a2e">${data.branch.name}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;color:#6b7280">Was Scheduled</td>
        <td style="padding:8px 12px;font-weight:bold;color:#1a1a2e">${data.scheduledAt}</td>
      </tr>
    </table>
    <p style="color:#6b7280;font-size:14px;margin:16px 0 0">You can rebook anytime through the app. We hope to see you again soon!</p>
  `;

  return {
    subject: `Booking Cancelled — ${data.serviceName} at ${data.branch.name}`,
    html: wrapInLayout(data.branch, body),
  };
}
