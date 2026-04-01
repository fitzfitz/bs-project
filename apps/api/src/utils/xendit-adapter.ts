const XENDIT_INVOICE_URL = "https://api.xendit.co/v2/invoices";

export interface XenditInvoiceResponse {
  id: string;
  invoice_url: string;
}

export async function createXenditInvoice(params: {
  secretKey: string;
  externalId: string;
  amount: number;
  currency?: string;
  description?: string;
  successRedirectUrl: string;
  failureRedirectUrl: string;
}): Promise<XenditInvoiceResponse> {
  const auth = Buffer.from(`${params.secretKey}:`).toString("base64");

  const body: Record<string, unknown> = {
    external_id: params.externalId,
    amount: params.amount,
    description: params.description ?? `Payment for ${params.externalId}`,
    success_redirect_url: params.successRedirectUrl,
    failure_redirect_url: params.failureRedirectUrl,
  };
  if (params.currency) {
    body.currency = params.currency;
  }

  const res = await fetch(XENDIT_INVOICE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Xendit API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as XenditInvoiceResponse;
  return data;
}
