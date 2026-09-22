-- Add a soft-hide flag to "users" for offboarded accounts.
--
-- When someone leaves the company their Google Workspace account is removed,
-- which blocks new OAuth logins but leaves their row and historical
-- submissions in place — so they kept showing up on the leaderboard, their
-- profile stayed reachable, and any personal API token they had issued kept
-- working (api_tokens.expires_at is nullable).
--
-- Hiding is deliberately a soft flag rather than a DELETE: their past usage
-- still belongs in org-wide totals, and re-hiring only needs the flag cleared.
-- Every public read path filters on `hidden_at IS NULL` via
-- lib/db/visibility.ts; auth paths reject hidden users outright.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hidden_reason" varchar(100);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_hidden_at" ON "users" ("hidden_at");
