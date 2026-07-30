import { createRepository } from "./base.repo.js";

const repo = createRepository("ratings", "rating");

export const ratingsRepo = {
  listByDocument(documentId) {
    return repo
      .filter((rating) => rating.documentId === documentId)
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  },

  add(data) {
    return repo.insert(data);
  },

  /** Returns a neutral summary rather than NaN when a document has no reviews. */
  summary(documentId) {
    const reviews = this.listByDocument(documentId);
    const average = reviews.length
      ? Number((reviews.reduce((total, review) => total + review.rating, 0) / reviews.length).toFixed(1))
      : 0;
    return { averageRating: average, totalReviews: reviews.length, reviews };
  },
};
