export type CartItem = {
  serviceId?: string;
  productId?: string;
  name: string;
  unitPrice: number;
  qty: number;
  discount: number;
};

export type PaymentMethod = "CASH" | "CARD" | "QRIS" | "DIGITAL_WALLET";
