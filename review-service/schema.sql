-- Raw reviews table
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    space_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    booking_id INTEGER NOT NULL UNIQUE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pre-materialized ratings for performance
CREATE TABLE space_ratings_summary (
    space_id INTEGER PRIMARY KEY,
    total_reviews INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0.0
);
