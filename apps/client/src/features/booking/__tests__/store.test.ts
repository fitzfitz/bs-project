import { describe, it, expect, beforeEach } from "vitest";
import { useBookingStore } from "../store";

describe("useBookingStore", () => {
  beforeEach(() => {
    useBookingStore.getState().resetBooking();
  });

  it("setBranchInfo stores branchId", () => {
    useBookingStore.getState().setBranchInfo("br-1");
    expect(useBookingStore.getState().branchId).toBe("br-1");
  });

  it("toggleService adds and removes service ids", () => {
    useBookingStore.getState().toggleService("s1");
    expect(useBookingStore.getState().selectedServiceIds).toEqual(["s1"]);
    useBookingStore.getState().toggleService("s2");
    expect(useBookingStore.getState().selectedServiceIds).toEqual(["s1", "s2"]);
    useBookingStore.getState().toggleService("s1");
    expect(useBookingStore.getState().selectedServiceIds).toEqual(["s2"]);
  });

  it("setBarber stores null for any available", () => {
    useBookingStore.getState().setBarber("staff-1");
    expect(useBookingStore.getState().selectedBarberId).toBe("staff-1");
    useBookingStore.getState().setBarber(null);
    expect(useBookingStore.getState().selectedBarberId).toBeNull();
  });

  it("setDateTime stores date and HH:mm slot", () => {
    const d = new Date("2025-06-15T00:00:00.000Z");
    useBookingStore.getState().setDateTime(d, "14:30");
    expect(useBookingStore.getState().selectedTimeSlot).toBe("14:30");
    expect(useBookingStore.getState().selectedDate?.toISOString()).toBe(
      d.toISOString(),
    );
  });

  it("resetBooking clears all fields", () => {
    useBookingStore.getState().setBranchInfo("b1");
    useBookingStore.getState().toggleService("s1");
    useBookingStore.getState().setBarber("st1");
    useBookingStore.getState().setDateTime(new Date(), "10:00");
    useBookingStore.getState().resetBooking();
    const s = useBookingStore.getState();
    expect(s.branchId).toBeNull();
    expect(s.selectedServiceIds).toEqual([]);
    expect(s.selectedBarberId).toBeNull();
    expect(s.selectedDate).toBeNull();
    expect(s.selectedTimeSlot).toBeNull();
  });
});
