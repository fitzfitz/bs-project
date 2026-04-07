/** Branch info injected into every email header/footer */
export interface BranchInfo {
  name: string;
  address: string;
  city: string;
  phone?: string | null;
  email?: string | null;
  imageUrl?: string | null;
}

/** All template functions return this shape */
export interface EmailOutput {
  subject: string;
  html: string;
}

/** Line item for payment receipt emails */
export interface ReceiptLineItem {
  name: string;
  quantity: number;
  price: number;
}
