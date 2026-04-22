const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/reviewController");

// POST /reviews - Submit a new review
router.post("/", reviewController.submitReview);

// GET /reviews/rating/:spaceId - Get average rating summary
router.get("/rating/:spaceId", reviewController.getRatingSummary);

module.exports = router;
