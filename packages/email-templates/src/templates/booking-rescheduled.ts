import type { BranchInfo, EmailOutput } from "../types";
import { wrapInLayout } from "../layout";

export interface BookingRescheduledData {
  customerName: string;
  serviceName: string;
  oldTime: string;
  newTime: string;
  branch: BranchInfo;
}

export function bookingRescheduledEmail(data: BookingRescheduledData): EmailOutput {
  const body = `
    <h2 style="margin:0 0 16px;color:#2563eb">Booking Rescheduled 📅</h2>
    <p style="margin:0 0 8px;color:#374151">Hi ${data.customerName},</p>
    <p style="margin:0 0 16px;color:#374151">Your booking has been rescheduled. Here are the updated details:</p>
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
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280">Previous Time</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-decoration:line-through;color:#9ca3af">${data.oldTime}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;color:#6b7280">New Time</td>
        <td style="padding:8px 12px;font-weight:bold;color:#059669">${data.newTime}</td>
      </tr>
    </table>
    <p style="color:#6b7280;font-size:14px;margin:16px 0 0">If this doesn't work for you, please reschedule through the app.</p>
  `;

  return {
    subject: `Booking Rescheduled — ${data.serviceName} at ${data.branch.name}`,
    html: wrapInLayout(data.branch, body),
  };
}
