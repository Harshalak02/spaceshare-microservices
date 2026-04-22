const express = require("express");
const reviewRoutes = require("./routes/reviewRoutes");

const app = express();

app.use(express.json());

// Health Check
app.get("/health", (req, res) => res.status(200).json({ status: "UP" }));

// Routes
app.use("/reviews", reviewRoutes);

module.exports = app;
