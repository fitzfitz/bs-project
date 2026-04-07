import type { BranchInfo } from "./types";

/**
 * Wraps email body content in a branded layout with branch-specific header and footer.
 * Uses table-based layout for maximum email client compatibility.
 * Inline CSS only — no <style> blocks (Gmail strips them).
 */
export function wrapInLayout(branch: BranchInfo, bodyHtml: string): string {
  const logoHtml = branch.imageUrl
    ? `<img src="${branch.imageUrl}" alt="${branch.name}" style="max-height:48px;margin-bottom:8px"><br>`
    : "";

  const phoneHtml = branch.phone
    ? `<p style="margin:4px 0">📞 ${branch.phone}</p>`
    : "";

  const emailHtml = branch.email
    ? `<p style="margin:4px 0">✉️ ${branch.email}</p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7">
    <tr><td align="center" style="padding:24px 16px">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden">
        <!-- HEADER -->
        <tr><td style="background:#1a1a2e;padding:24px;text-align:center">
          ${logoHtml}
          <span style="color:#ffffff;font-size:20px;font-weight:bold">${branch.name}</span>
        </td></tr>
        <!-- BODY -->
        <tr><td style="padding:32px 24px">
          ${bodyHtml}
        </td></tr>
        <!-- FOOTER -->
        <tr><td style="background:#f4f4f7;padding:16px 24px;text-align:center;font-size:12px;color:#6b7280">
          <p style="margin:0">${branch.name} · ${branch.address}, ${branch.city}</p>
          ${phoneHtml}
          ${emailHtml}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
