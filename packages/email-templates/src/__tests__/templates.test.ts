import { describe, it, expect } from "vitest";
import { bookingConfirmedEmail } from "../templates/booking-confirmed";
import { bookingCancelledEmail } from "../templates/booking-cancelled";
import { bookingRescheduledEmail } from "../templates/booking-rescheduled";
import { paymentReceiptEmail } from "../templates/payment-receipt";
import type { BranchInfo } from "../types";

const branch: BranchInfo = {
  name: "Budi's Barbershop - Kemang",
  address: "Jl. Kemang Raya No. 10",
  city: "Jakarta",
  phone: "+6281200000001",
  email: "kemang@budis.com",
  imageUrl: "https://cdn.example.com/logo.png",
};

describe("bookingConfirmedEmail", () => {
  const result = bookingConfirmedEmail({
    customerName: "John Doe",
    serviceName: "Gentleman's Cut",
    scheduledAt: "Apr 10, 2026 at 2:00 PM",
    branch,
  });

  it("returns subject containing service and branch name", () => {
    expect(result.subject).toContain("Gentleman's Cut");
    expect(result.subject).toContain(branch.name);
  });

  it("returns HTML containing customer name", () => {
    expect(result.html).toContain("John Doe");
  });

  it("returns HTML containing scheduled time", () => {
    expect(result.html).toContain("Apr 10, 2026 at 2:00 PM");
  });

  it("returns HTML containing branch name", () => {
    expect(result.html).toContain(branch.name);
  });

  it("wraps content in the branded layout", () => {
    expect(result.html).toContain("<!DOCTYPE html>");
    expect(result.html).toContain(branch.address);
  });
});

describe("bookingCancelledEmail", () => {
  const result = bookingCancelledEmail({
    customerName: "Jane Smith",
    serviceName: "Hair Wash",
    scheduledAt: "Apr 11, 2026 at 10:00 AM",
    branch,
  });

  it("returns subject mentioning cancellation", () => {
    expect(result.subject.toLowerCase()).toContain("cancel");
  });

  it("returns HTML with booking details", () => {
    expect(result.html).toContain("Jane Smith");
    expect(result.html).toContain("Hair Wash");
    expect(result.html).toContain("Apr 11, 2026 at 10:00 AM");
  });
});

describe("bookingRescheduledEmail", () => {
  const result = bookingRescheduledEmail({
    customerName: "Bob Wilson",
    serviceName: "Beard Trim",
    oldTime: "Apr 12, 2026 at 3:00 PM",
    newTime: "Apr 13, 2026 at 4:00 PM",
    branch,
  });

  it("returns subject mentioning reschedule", () => {
    expect(result.subject.toLowerCase()).toContain("reschedule");
  });

  it("returns HTML with both old and new times", () => {
    expect(result.html).toContain("Apr 12, 2026 at 3:00 PM");
    expect(result.html).toContain("Apr 13, 2026 at 4:00 PM");
  });

  it("returns HTML with customer and service name", () => {
    expect(result.html).toContain("Bob Wilson");
    expect(result.html).toContain("Beard Trim");
  });
});

describe("paymentReceiptEmail", () => {
  const result = paymentReceiptEmail({
    customerName: "Alice Brown",
    branchName: branch.name,
    items: [
      { name: "Gentleman's Cut", quantity: 1, price: 150000 },
      { name: "Hair Wash", quantity: 1, price: 50000 },
    ],
    totalDue: 200000,
    currency: "IDR",
    paidAt: "Apr 10, 2026 at 3:30 PM",
    branch,
  });

  it("returns subject with branch name", () => {
    expect(result.subject).toContain(branch.name);
  });

  it("returns HTML with itemized line items", () => {
    expect(result.html).toContain("Gentleman's Cut");
    expect(result.html).toContain("Hair Wash");
  });

  it("returns HTML with total", () => {
    expect(result.html).toContain("200,000");
  });

  it("formats currency using provided currency code", () => {
    expect(result.html).toContain("IDR");
  });

  it("returns HTML with customer name", () => {
    expect(result.html).toContain("Alice Brown");
  });
});
