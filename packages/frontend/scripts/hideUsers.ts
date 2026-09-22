/**
 * Hide (or unhide) users on the self-hosted leaderboard.
 *
 * Hiding removes someone from every public surface and revokes their API
 * tokens and sessions, while keeping their submissions so org-wide totals stay
 * accurate. Use it when someone leaves and their Google Workspace account is
 * gone — Workspace removal alone does not stop an already-issued CLI token.
 *
 *   bun run users:hide -- @alice @bob
 *   bun run users:hide -- --email alice@corp.com --dry-run
 *   bun run users:hide -- --file offboarded.txt
 *   bun run users:hide -- @alice --unhide
 *
 * Requires DATABASE_URL. Against the production database also pass
 * NODE_ENV=production so the client connects with SSL. Set NEXT_PUBLIC_URL and
 * CRON_SECRET too, so the deployed app can be told to drop its cached copies of
 * the affected profiles — without that the profile page keeps serving them.
 */
import { readFileSync } from "node:fs";
import {
  REASON_MANUAL,
  hideUsers,
  resolveUsers,
  unhideUsers,
} from "@/lib/offboarding/hideUsers";

interface Options {
  identifiers: string[];
  unhide: boolean;
  dryRun: boolean;
  reason: string;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    identifiers: [],
    unhide: false,
    dryRun: false,
    reason: REASON_MANUAL,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case "--unhide":
        options.unhide = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--reason":
        options.reason = argv[++i] ?? REASON_MANUAL;
        break;
      case "--email":
      case "--username":
        if (argv[++i]) options.identifiers.push(argv[i]);
        break;
      case "--file": {
        const path = argv[++i];
        if (!path) throw new Error("--file needs a path");
        const lines = readFileSync(path, "utf8")
          .split("\n")
          .map((line) => line.split("#")[0].trim())
          .filter(Boolean);
        options.identifiers.push(...lines);
        break;
      }
      default:
        if (arg.startsWith("-")) {
          throw new Error(`Unknown flag: ${arg}`);
        }
        options.identifiers.push(arg);
    }
  }

  return options;
}

/**
 * Ask the deployed app to drop its cached views of these users.
 *
 * This script talks to the database directly, so it cannot call Next's
 * revalidation APIs itself. Without this the profile page keeps serving the
 * last successful response and a hidden user stays readable at /u/<username>.
 */
async function refreshCaches(usernames: string[]): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_URL;
  const secret = process.env.CRON_SECRET;

  if (!baseUrl || !secret) {
    console.warn(
      "\n  ! NEXT_PUBLIC_URL / CRON_SECRET not set — cached pages were not refreshed."
    );
    console.warn(
      "    /u/<username> may keep serving these profiles until those caches are dropped."
    );
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/api/internal/revalidate-user`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ usernames }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    console.log(`  refreshed cached pages for ${usernames.length} user(s)`);
  } catch (error) {
    console.warn(
      `\n  ! cache refresh failed (${error instanceof Error ? error.message : "unknown"}).`
    );
    console.warn("    /u/<username> may keep serving these profiles.");
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const options = parseArgs(process.argv.slice(2));

  if (options.identifiers.length === 0) {
    console.error(
      "Nothing to do. Pass usernames/emails as arguments, or use --file <path>."
    );
    process.exit(1);
  }

  const { found, missing } = await resolveUsers(options.identifiers);

  for (const identifier of missing) {
    console.warn(`  ! no user matches "${identifier}"`);
  }

  if (found.length === 0) {
    console.error("No matching users; nothing changed.");
    process.exit(1);
  }

  const action = options.unhide ? "unhide" : "hide";
  const actionable = options.unhide
    ? found.filter((user) => user.hiddenAt != null)
    : found.filter((user) => user.hiddenAt == null);
  const noop = found.filter((user) => !actionable.includes(user));

  for (const user of noop) {
    console.log(
      `  = @${user.username} already ${options.unhide ? "visible" : "hidden"}, skipping`
    );
  }

  if (actionable.length === 0) {
    console.log("Nothing to change.");
    return;
  }

  if (options.dryRun) {
    console.log(`\nDry run — would ${action}:`);
    for (const user of actionable) {
      console.log(`  - @${user.username} <${user.email ?? "no email"}>`);
    }
    console.log("\nRe-run without --dry-run to apply.");
    return;
  }

  if (options.unhide) {
    const restored = await unhideUsers(actionable.map((user) => user.id));
    for (const username of restored) {
      console.log(`  + @${username} is visible again`);
    }

    await refreshCaches(restored);
    console.log(
      `\nUnhid ${restored.length} user(s). Revoked API tokens are NOT restored — they must issue new ones.`
    );
    return;
  }

  const results = await hideUsers(
    actionable.map((user) => user.id),
    options.reason
  );

  for (const result of results) {
    console.log(
      `  - @${result.username} hidden (revoked ${result.tokensDeleted} token(s), ${result.sessionsDeleted} session(s))`
    );
  }

  await refreshCaches(results.map((result) => result.username));

  console.log(
    `\nHid ${results.length} user(s). Public pages catch up within ~60 s.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
