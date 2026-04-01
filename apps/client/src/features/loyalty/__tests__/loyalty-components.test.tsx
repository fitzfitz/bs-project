import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoyaltyCard } from "../components/loyalty-card";
import { TierProgressBar } from "../components/tier-progress-bar";
import { PointsHistoryList } from "../components/points-history-list";
import { ReferralShareCard } from "../components/referral-share-card";

describe("loyalty components", () => {
  it("LoyaltyCard shows tier and balance", () => {
    render(
      <LoyaltyCard
        account={{
          id: "m1",
          userId: "u1",
          pointsBalance: 1000,
          lifetimePoints: 1000,
          tier: "GOLD",
          tierMultiplier: 1.5,
          pointsExpiringAt: null,
          lastActivityAt: null,
          createdAt: "",
        }}
      />,
    );
    expect(screen.getByText("GOLD")).toBeInTheDocument();
    expect(screen.getByText(/1\.?5.*points/i)).toBeInTheDocument();
  });

  it("TierProgressBar shows max tier message for PLATINUM", () => {
    render(
      <TierProgressBar lifetimePoints={2000} currentTier="PLATINUM" />,
    );
    expect(screen.getByText(/maximum tier reached/i)).toBeInTheDocument();
  });

  it("PointsHistoryList shows empty state", () => {
    render(
      <PointsHistoryList
        transactions={[]}
        page={1}
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByText(/no transactions yet/i)).toBeInTheDocument();
  });

  it("PointsHistoryList shows earn and redeem rows", () => {
    render(
      <PointsHistoryList
        transactions={[
          {
            id: "t1",
            points: 50,
            description: "Visit",
            transactionId: null,
            createdAt: "2025-03-01T12:00:00.000Z",
          },
          {
            id: "t2",
            points: -20,
            description: "Redeem",
            transactionId: null,
            createdAt: "2025-03-02T12:00:00.000Z",
          },
        ]}
        page={1}
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByText("Visit")).toBeInTheDocument();
    expect(screen.getByText("Redeem")).toBeInTheDocument();
  });

  it("PointsHistoryList shows pagination controls", async () => {
    const onPage = vi.fn();
    render(
      <PointsHistoryList
        transactions={[
          {
            id: "1",
            points: 1,
            description: "A",
            transactionId: null,
            createdAt: "",
          },
        ]}
        pagination={{ page: 1, limit: 20, total: 40, totalPages: 2 }}
        page={1}
        onPageChange={onPage}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /^next$/i }),
    );
    expect(onPage).toHaveBeenCalledWith(2);
  });

  it("ReferralShareCard shows skeleton when loading", () => {
    const { container } = render(
      <ReferralShareCard referralCode={undefined} isLoading />,
    );
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("ReferralShareCard copies code to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText },
    });

    render(
      <ReferralShareCard referralCode="XYZ99" history={[]} isLoading={false} />,
    );

    const buttons = screen.getAllByRole("button");
    await userEvent.click(buttons[0]);

    expect(writeText).toHaveBeenCalledWith("XYZ99");
    vi.unstubAllGlobals();
  });
});
