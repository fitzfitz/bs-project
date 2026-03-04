export type Review = {
  id: string;
  customerId: string;
  customerName: string;
  staffProfileId: string | null;
  staffName: string | null;
  branchId: string | null;
  rating: number;
  comment: string | null;
  photoUrls: string[];
  isVisible: boolean;
  createdAt: string;
};

export type CreateReviewInput = {
  staffProfileId?: string;
  branchId: string;
  rating: number;
  comment?: string;
  photoUrls?: string[];
  queueEntryId?: string;
};

export type ReviewSummary = {
  averageRating: number;
  totalReviews: number;
  distribution: Record<number, number>;
};
