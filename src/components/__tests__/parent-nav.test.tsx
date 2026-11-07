import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { ParentBottomNav } from "../parent/ParentBottomNav";

describe("Component: ParentBottomNav (Parent Mobile Navigation)", () => {
  it("renders with role='navigation' and proper accessible label", () => {
    const html = renderToString(<ParentBottomNav activeTab="FEES" />);
    expect(html).toContain('role="navigation"');
    expect(html).toContain('aria-label="Parent Portal Navigation"');
  });

  it("renders all 4 destinations: Fees, Receipts, Academics, Policy", () => {
    const html = renderToString(<ParentBottomNav activeTab="FEES" />);
    expect(html).toContain("Fees");
    expect(html).toContain("Receipts");
    expect(html).toContain("Academics");
    expect(html).toContain("Policy");
  });

  it("marks active destination with aria-current='page'", () => {
    const html = renderToString(<ParentBottomNav activeTab="FEES" />);
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("href=\"/parent?tab=FEES\"");
    expect(html).toContain("href=\"/parent/refund-policy\"");
  });

  it("highlights Policy when activeTab is POLICY", () => {
    const html = renderToString(<ParentBottomNav activeTab="POLICY" />);
    expect(html).toContain('aria-current="page"');
  });
});
