import { describe, it, expect } from "vitest";
import { wrapInLayout } from "../layout";
import type { BranchInfo } from "../types";

const baseBranch: BranchInfo = {
  name: "Budi's Barbershop - Kemang",
  address: "Jl. Kemang Raya No. 10",
  city: "Jakarta",
  phone: "+6281200000001",
  email: "kemang@budis.com",
  imageUrl: "https://cdn.example.com/logo.png",
};

describe("wrapInLayout", () => {
  it("injects branch name into header", () => {
    const html = wrapInLayout(baseBranch, "<p>Hello</p>");
    expect(html).toContain(baseBranch.name);
  });

  it("injects branch logo when imageUrl is provided", () => {
    const html = wrapInLayout(baseBranch, "<p>Body</p>");
    expect(html).toContain(`src="${baseBranch.imageUrl}"`);
  });

  it("omits logo img when imageUrl is null", () => {
    const branchNoLogo = { ...baseBranch, imageUrl: null };
    const html = wrapInLayout(branchNoLogo, "<p>Body</p>");
    expect(html).not.toContain("<img");
  });

  it("includes branch address and city in footer", () => {
    const html = wrapInLayout(baseBranch, "<p>Body</p>");
    expect(html).toContain(baseBranch.address);
    expect(html).toContain(baseBranch.city);
  });

  it("includes phone in footer when provided", () => {
    const html = wrapInLayout(baseBranch, "<p>Body</p>");
    expect(html).toContain(baseBranch.phone!);
  });

  it("omits phone in footer when null", () => {
    const branchNoPhone = { ...baseBranch, phone: null };
    const html = wrapInLayout(branchNoPhone, "<p>Body</p>");
    expect(html).not.toContain("📞");
  });

  it("includes email in footer when provided", () => {
    const html = wrapInLayout(baseBranch, "<p>Body</p>");
    expect(html).toContain(baseBranch.email!);
  });

  it("omits email in footer when null", () => {
    const branchNoEmail = { ...baseBranch, email: null };
    const html = wrapInLayout(branchNoEmail, "<p>Body</p>");
    expect(html).not.toContain("✉️");
  });

  it("wraps the provided body HTML in the layout", () => {
    const bodyContent = "<h2>Custom Content</h2><p>Details here</p>";
    const html = wrapInLayout(baseBranch, bodyContent);
    expect(html).toContain(bodyContent);
  });

  it("produces valid HTML structure", () => {
    const html = wrapInLayout(baseBranch, "<p>Test</p>");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html>");
    expect(html).toContain("</html>");
    expect(html).toContain('<meta charset="utf-8">');
  });
});
