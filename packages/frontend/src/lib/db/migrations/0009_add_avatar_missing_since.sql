-- Track when a user's Google avatar first came back as the "photo
-- unavailable" placeholder.
--
-- Deleting a Google Workspace account makes lh3.googleusercontent.com serve a
-- fixed grayscale placeholder for that user's photo URL (HTTP 200, identical
-- bytes for every deleted account) instead of their picture. A malformed photo
-- id answers 400 instead, so a 200 carrying exactly those bytes is a specific
-- signal rather than generic URL rot.
--
-- It is still only a proxy for "this person left", so the probe never hides on
-- a single sighting: the first run records the timestamp here and a later run
-- confirms it before hiding. The column is cleared as soon as a real avatar
-- comes back.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_missing_since" timestamp with time zone;
