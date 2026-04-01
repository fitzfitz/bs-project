import { describe, it, expect, vi, afterEach } from "vitest";
import { formatDate, formatRelativeTime, getInitials, formatNumber } from "@/lib/utils";

describe("formatDate", () => {
  it("formats short date", () => {
    const result = formatDate("2025-06-15T10:00:00Z", "short");
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2025/);
  });

  it("formats long date", () => {
    const result = formatDate("2025-01-01T00:00:00Z", "long");
    expect(result).toMatch(/January/);
  });

  it("defaults to short style", () => {
    const result = formatDate("2025-03-10");
    expect(result).toMatch(/Mar/);
  });
});

describe("formatRelativeTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for very recent times", () => {
    const result = formatRelativeTime(new Date());
    expect(result).toBe("just now");
  });

  it("returns minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(fiveMinAgo)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoHoursAgo)).toBe("2h ago");
  });

  it("returns 'yesterday'", () => {
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(formatRelativeTime(yesterday)).toBe("yesterday");
  });

  it("returns days ago for recent dates", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(threeDaysAgo)).toBe("3d ago");
  });

  it("returns formatted date for old dates", () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(twoWeeksAgo);
    expect(result).toMatch(/\w+ \d+/);
  });
});

describe("getInitials", () => {
  it("returns first + last initial", () => {
    expect(getInitials("John", "Doe")).toBe("JD");
  });

  it("returns only first initial when no last name", () => {
    expect(getInitials("Alice")).toBe("A");
  });

  it("handles lowercase input", () => {
    expect(getInitials("john", "doe")).toBe("JD");
  });
});

describe("formatNumber", () => {
  it("formats with commas for US locale", () => {
    expect(formatNumber(1000000)).toBe("1,000,000");
  });

  it("formats with period for ID locale", () => {
    const result = formatNumber(1000000, "id-ID");
    expect(result).toMatch(/1[.\s]000[.\s]000/);
  });

  it("handles zero", () => {
    expect(formatNumber(0)).toBe("0");
  });
});
