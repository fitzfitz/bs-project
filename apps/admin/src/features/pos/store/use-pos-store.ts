import { create } from "zustand";
import type { CartItem, PaymentMethod } from "../types";

interface POSState {
  cartItems: CartItem[];
  discountValue: number;
  tipAmount: number;
  selectedPaymentMethod: PaymentMethod | null;
  queueEntryId: string | null;
  /** When set, checkout skips transaction creation and pays this existing transaction */
  pendingTransactionId: string | null;
  pendingTransactionTotal: number | null;
  addItem: (item: Omit<CartItem, "qty" | "discount"> & { qty?: number }) => void;
  removeItem: (index: number) => void;
  updateQuantity: (index: number, qty: number) => void;
  setDiscount: (value: number) => void;
  setTip: (amount: number) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setQueueEntryId: (id: string | null) => void;
  setPendingTransaction: (id: string, totalDue: number) => void;
  reset: () => void;
}

const initialState = {
  cartItems: [],
  discountValue: 0,
  tipAmount: 0,
  selectedPaymentMethod: null as PaymentMethod | null,
  queueEntryId: null as string | null,
  pendingTransactionId: null as string | null,
  pendingTransactionTotal: null as number | null,
};

export const usePOSStore = create<POSState>((set) => ({
  ...initialState,
  addItem: (item) =>
    set((state) => {
      const existing = state.cartItems.findIndex(
        (i) => (i.serviceId && i.serviceId === item.serviceId) || (i.productId && i.productId === item.productId)
      );
      const newItem = { ...item, qty: item.qty ?? 1, discount: 0 };
      if (existing >= 0) {
        const next = [...state.cartItems];
        next[existing].qty += newItem.qty;
        return { cartItems: next };
      }
      return { cartItems: [...state.cartItems, { ...newItem, name: item.name, unitPrice: item.unitPrice }] };
    }),
  removeItem: (index) =>
    set((state) => ({ cartItems: state.cartItems.filter((_, i) => i !== index) })),
  updateQuantity: (index, qty) =>
    set((state) => {
      const next = [...state.cartItems];
      if (next[index]) next[index].qty = Math.max(1, qty);
      return { cartItems: next };
    }),
  setDiscount: (discountValue) => set({ discountValue }),
  setTip: (tipAmount) => set({ tipAmount }),
  setPaymentMethod: (selectedPaymentMethod) => set({ selectedPaymentMethod }),
  setQueueEntryId: (queueEntryId) => set({ queueEntryId }),
  setPendingTransaction: (id, totalDue) =>
    set({ pendingTransactionId: id, pendingTransactionTotal: totalDue }),
  reset: () => set(initialState),
}));
