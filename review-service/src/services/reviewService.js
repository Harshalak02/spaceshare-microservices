const pool = require("../models/reviewModel");
const Redis = require("ioredis");
const axios = require("axios");

const redis = new Redis(process.env.REDIS_URL);

class ReviewService {
  async createReview(reviewData) {
    const { space_id, user_id, booking_id, rating, comment } = reviewData;

    // 1. Authenticity Check: Verify booking exists via Booking Service
    try {
      const bookingCheck = await axios.get(
        `${process.env.BOOKING_SERVICE_URL}/bookings/id/${booking_id}`,
      );
      if (bookingCheck.data.user_id !== user_id)
        throw new Error("Unauthorized booking");
    } catch (err) {
      throw new Error("Invalid Booking ID or verification failed");
    }

    // 2. Save Review to PostgreSQL
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        "INSERT INTO reviews (space_id, user_id, booking_id, rating, comment) VALUES ($1, $2, $3, $4, $5)",
        [space_id, user_id, booking_id, rating, comment],
      );

      // 3. Update Materialized View (Summary)
      await client.query(
        `
                INSERT INTO space_ratings_summary (space_id, total_reviews, average_rating)
                VALUES ($1, 1, $2)
                ON CONFLICT (space_id) DO UPDATE SET
                average_rating = (space_ratings_summary.average_rating * space_ratings_summary.total_reviews + $2) / (space_ratings_summary.total_reviews + 1),
                total_reviews = space_ratings_summary.total_reviews + 1
            `,
        [space_id, rating],
      );

      await client.query("COMMIT");

      // 4. Publish Event to Redis for Notification/Analytics Services
      await redis.publish(
        "events",
        JSON.stringify({
          type: "REVIEW_SUBMITTED",
          data: { space_id, rating },
        }),
      );

      return { message: "Review submitted successfully" };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async getSpaceRating(space_id) {
    const res = await pool.query(
      "SELECT * FROM space_ratings_summary WHERE space_id = $1",
      [space_id],
    );
    return res.rows[0] || { space_id, total_reviews: 0, average_rating: 0 };
  }
}

module.exports = new ReviewService();
