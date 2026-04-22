const reviewService = require("../services/reviewService");

exports.submitReview = async (req, res) => {
  try {
    const result = await reviewService.createReview(req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error("Error in submitReview:", error.message);
    res.status(400).json({ error: error.message });
  }
};

exports.getRatingSummary = async (req, res) => {
  try {
    const spaceId = req.params.spaceId;
    const summary = await reviewService.getSpaceRating(spaceId);
    res.status(200).json(summary);
  } catch (error) {
    console.error("Error in getRatingSummary:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
