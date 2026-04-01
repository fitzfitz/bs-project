import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReviewFeed } from "../widgets/review-feed";
import { ReviewCard } from "../components/review-card";
import { ReviewSummary } from "../components/review-summary";
import { StarRatingInput } from "../components/star-rating-input";
import { PostReviewDialog } from "../widgets/post-review-dialog";

const API = "http://localhost:8787/api";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

const sampleReview = {
  id: "rv1",
  customerId: "c1",
  customerName: "Ann",
  staffProfileId: "st1",
  staffName: "Sam",
  branchId: "b1",
  rating: 4,
  comment: "Good cut",
  photoUrls: [] as string[],
  isVisible: true,
  createdAt: "2025-03-01T12:00:00.000Z",
};

describe("reviews components", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("ReviewFeed shows loading then reviews", async () => {
    const qc = createQueryClient();
    server.use(
      http.get(`${API}/reviews`, () =>
        HttpResponse.json({
          success: true,
          data: [sampleReview],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }),
      ),
    );

    render(
      <QueryClientProvider client={qc}>
        <ReviewFeed branchId="b1" pageSize={10} />
      </QueryClientProvider>,
    );

    expect(document.querySelector(".animate-spin")).toBeTruthy();

    await waitFor(() =>
      expect(screen.getByText("Ann")).toBeInTheDocument(),
    );
    expect(screen.getByText(/good cut/i)).toBeInTheDocument();
  });

  it("ReviewFeed shows empty state when no reviews", async () => {
    const qc = createQueryClient();
    server.use(
      http.get(`${API}/reviews`, () =>
        HttpResponse.json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      ),
    );

    render(
      <QueryClientProvider client={qc}>
        <ReviewFeed staffProfileId="st1" pageSize={10} />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText(/no reviews yet/i)).toBeInTheDocument(),
    );
  });

  it("ReviewCard renders rating and comment", () => {
    render(<ReviewCard review={sampleReview} />);
    expect(screen.getByText("Ann")).toBeInTheDocument();
    expect(screen.getByText(/good cut/i)).toBeInTheDocument();
    expect(screen.getByText(/with sam/i)).toBeInTheDocument();
  });

  it("ReviewSummary computes average from reviews", () => {
    render(
      <ReviewSummary
        reviews={[
          { ...sampleReview, id: "1", rating: 4 },
          { ...sampleReview, id: "2", rating: 2 },
        ]}
      />,
    );
    expect(screen.getByText("3.0")).toBeInTheDocument();
  });

  it("StarRatingInput calls onChange", async () => {
    const onChange = vi.fn();
    render(<StarRatingInput value={0} onChange={onChange} size="md" />);
    const stars = screen.getAllByRole("button");
    await userEvent.click(stars[4]);
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("PostReviewDialog returns null when closed", () => {
    const qc = createQueryClient();
    const { container } = render(
      <QueryClientProvider client={qc}>
        <PostReviewDialog
          open={false}
          onClose={() => {}}
          branchId="b1"
        />
      </QueryClientProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("PostReviewDialog submits review", async () => {
    const qc = createQueryClient();
    server.use(
      http.post(`${API}/reviews`, () =>
        HttpResponse.json({ success: true, data: sampleReview }),
      ),
    );

    const onClose = vi.fn();

    render(
      <QueryClientProvider client={qc}>
        <PostReviewDialog
          open
          onClose={onClose}
          branchId="b1"
          staffProfileId="st1"
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText(/leave a review/i)).toBeInTheDocument();

    const buttons = screen.getAllByRole("button");
    await userEvent.click(buttons[5]);

    await userEvent.click(
      screen.getByRole("button", { name: /submit review/i }),
    );

    await waitFor(() =>
      expect(screen.getByText(/thank you/i)).toBeInTheDocument(),
    );
  });
});
