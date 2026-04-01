import { describe, it, expect } from "vitest";
import {
  navGroups,
  barberNav,
  getRouteLabel,
  getAllNavItems,
  findGroupForRoute,
} from "@/lib/nav-config";

describe("nav-config", () => {
  it("exports 5 navigation groups", () => {
    expect(navGroups).toHaveLength(5);
  });

  it("every group has required fields", () => {
    for (const group of navGroups) {
      expect(group.id).toBeTruthy();
      expect(group.labelKey).toBeTruthy();
      expect(group.icon).toBeTruthy();
      expect(group.items.length).toBeGreaterThan(0);
    }
  });

  it("every nav item has required fields", () => {
    const allItems = getAllNavItems();
    for (const item of allItems) {
      expect(item.to).toBeTruthy();
      expect(item.labelKey).toBeTruthy();
      expect(item.icon).toBeTruthy();
    }
  });

  it("daily-ops group is defaultOpen", () => {
    const dailyOps = navGroups.find((g) => g.id === "daily-ops");
    expect(dailyOps?.defaultOpen).toBe(true);
  });

  it("barberNav has 4 items", () => {
    expect(barberNav).toHaveLength(4);
  });

  it("getRouteLabel returns label for known route", () => {
    const label = getRouteLabel("/queue");
    expect(label).toBeDefined();
    expect(label?.labelKey).toBe("sidebar:queue");
    expect(label?.groupLabelKey).toBe("sidebar:dailyOperations");
  });

  it("getRouteLabel returns undefined for unknown route", () => {
    expect(getRouteLabel("/nonexistent")).toBeUndefined();
  });

  it("findGroupForRoute returns the correct group", () => {
    const group = findGroupForRoute("/analytics");
    expect(group?.id).toBe("admin");
  });

  it("findGroupForRoute returns undefined for unknown route", () => {
    expect(findGroupForRoute("/nonexistent")).toBeUndefined();
  });

  it("getAllNavItems returns all items from all groups", () => {
    const allItems = getAllNavItems();
    const totalFromGroups = navGroups.reduce((sum, g) => sum + g.items.length, 0);
    expect(allItems).toHaveLength(totalFromGroups);
  });

  it("route-to-label mapping covers all nav group routes", () => {
    for (const group of navGroups) {
      for (const item of group.items) {
        const label = getRouteLabel(item.to);
        expect(label).toBeDefined();
        expect(label?.labelKey).toBe(item.labelKey);
      }
    }
  });
});
