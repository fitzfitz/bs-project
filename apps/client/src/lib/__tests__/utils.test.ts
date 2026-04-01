import { describe, it, expect } from "vitest";
import { cn, formatCurrency } from "../utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("handles conditional classes", () => {
    const isHidden = false;
    expect(cn("base", isHidden && "hidden", "extra")).toBe("base extra");
  });

  it("deduplicates conflicting Tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("handles undefined and null inputs", () => {
    expect(cn("base", undefined, null, "end")).toBe("base end");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
});

describe("formatCurrency", () => {
  it("formats IDR with default locale", () => {
    const result = formatCurrency(150000);
    expect(result).toContain("150");
    expect(result).toContain("000");
  });

  it("formats zero amount", () => {
    const result = formatCurrency(0);
    expect(result).toContain("0");
  });

  it("formats with custom currency and locale", () => {
    const result = formatCurrency(1000, "USD", "en-US");
    expect(result).toContain("$");
    expect(result).toContain("1,000");
  });

  it("uses IDR as default currency", () => {
    const result = formatCurrency(50000);
    expect(result).toMatch(/Rp|IDR/);
  });

  it("formats large numbers", () => {
    const result = formatCurrency(1000000);
    expect(result).toContain("1.000.000");
  });

  it("has no fractional digits", () => {
    const result = formatCurrency(99999);
    // IDR with id-ID locale uses '.' as thousands separator, producing "Rp 99.999"
    // minimumFractionDigits: 0 means no ",00" or ".00" suffix
    expect(result).toMatch(/99\.999|99,999/);
    expect(result).not.toMatch(/,00|\.00/);
  });
});
