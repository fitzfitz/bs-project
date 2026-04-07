import type { BranchInfo, EmailOutput } from "../types";
import { wrapInLayout } from "../layout";

export interface BookingConfirmedData {
  customerName: string;
  serviceName: string;
  scheduledAt: string;
  branch: BranchInfo;
}

export function bookingConfirmedEmail(data: BookingConfirmedData): EmailOutput {
  const body = `
    <h2 style="margin:0 0 16px;color:#1a1a2e">Booking Confirmed! ✅</h2>
    <p style="margin:0 0 8px;color:#374151">Hi ${data.customerName},</p>
    <p style="margin:0 0 16px;color:#374151">Your booking has been confirmed. Here are the details:</p>
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
        <td style="padding:8px 12px;color:#6b7280">Date &amp; Time</td>
        <td style="padding:8px 12px;font-weight:bold;color:#1a1a2e">${data.scheduledAt}</td>
      </tr>
    </table>
    <p style="color:#6b7280;font-size:14px;margin:16px 0 0">See you soon! If you need to reschedule or cancel, use the app.</p>
  `;

  return {
    subject: `Your Booking is Confirmed — ${data.serviceName} at ${data.branch.name}`,
    html: wrapInLayout(data.branch, body),
  };
}
