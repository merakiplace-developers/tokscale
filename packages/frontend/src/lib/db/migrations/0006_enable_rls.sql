-- Enable Row Level Security on every table in the public schema.
--
-- Supabase auto-exposes the public schema via PostgREST for anyone holding
-- the anon/authenticated API keys. Without RLS, `GET /rest/v1/users` etc.
-- return data directly. Our backend does NOT use PostgREST: it connects via
-- DATABASE_URL as the `postgres` role (BYPASSRLS), so these changes do not
-- affect server code. We deliberately create no policies — anon and
-- authenticated get zero row access.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "api_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "device_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_breakdown" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Defense in depth: revoke table grants from Supabase's anon/authenticated
-- roles. RLS alone blocks row access; this also blocks even metadata probes.
-- Guarded with IF EXISTS so the migration is portable to non-Supabase Postgres.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE
      "users", "sessions", "api_tokens", "device_codes",
      "submissions", "daily_breakdown"
    FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE
      "users", "sessions", "api_tokens", "device_codes",
      "submissions", "daily_breakdown"
    FROM authenticated;
  END IF;
END
$$;
