import { revalidateTag } from "next/cache";
import {
  normalizeUsernameCacheKey,
  revalidateUsernamePaths,
} from "@/lib/db/usernameLookup";

/**
 * Drop every cached view of one user.
 *
 * The profile page fetches its own `/api/users/[username]` route, and Next
 * keeps serving the last successful response from the Data Cache when a later
 * revalidation answers 404 — which is exactly what happens once a user is
 * hidden. Path revalidation alone does not clear that entry, so the tagged
 * fetch has to be invalidated explicitly.
 */
export function revalidateUserCaches(username: string): void {
  const usernameCacheKey = normalizeUsernameCacheKey(username);

  revalidateUsernamePaths(username);
  revalidateTag(`user:${usernameCacheKey}`, "max");
  revalidateTag(`user-rank:${usernameCacheKey}`, "max");
  revalidateTag(`embed-user:${usernameCacheKey}`, "max");
  revalidateTag(`embed-user:${usernameCacheKey}:tokens`, "max");
  revalidateTag(`embed-user:${usernameCacheKey}:cost`, "max");
}
