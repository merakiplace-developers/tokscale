-- Extend Row Level Security to tables introduced after 0006_enable_rls.
--
-- 0006 was authored when public/ only had {users, sessions, api_tokens,
-- device_codes, submissions, daily_breakdown}. The 2026-05 upstream sync
-- added submitted_devices (0007) and the groups feature (0009: groups,
-- group_members, group_invites). Without this migration those new public
-- tables are exposed via Supabase's PostgREST anon/authenticated keys,
-- which is the exact regression 0006 was written to prevent.
--
-- Same defense-in-depth as 0006: enable RLS, create no policies, and
-- revoke table grants from the anon/authenticated roles (guarded with
-- IF EXISTS for non-Supabase Postgres).

ALTER TABLE "submitted_devices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "group_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "group_invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE
      "submitted_devices", "groups", "group_members", "group_invites"
    FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE
      "submitted_devices", "groups", "group_members", "group_invites"
    FROM authenticated;
  END IF;
END
$$;
