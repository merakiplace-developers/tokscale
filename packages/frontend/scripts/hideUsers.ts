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
 * NODE_ENV=production so the client connects with SSL.
 *
 * Public pages are cached for 60 s, so the change shows up within a minute.
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
