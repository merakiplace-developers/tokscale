import { isNull, sql } from "drizzle-orm";
import { users } from "./schema";

/**
 * Hidden users (offboarded accounts) must not appear on any public surface:
 * leaderboard listings and ranks, profile API, badge/embed SVGs. Their rows
 * and submissions are kept so org-wide totals stay accurate — only their
 * identity is withheld.
 *
 * Every read path that resolves a user for public display goes through this
 * condition so a new surface can't silently miss the filter.
 */
export function visibleUserCondition() {
  return isNull(users.hiddenAt);
}

/**
 * Same filter for raw-SQL queries that join `users` under an explicit alias.
 * Pass the alias used in the statement (e.g. `u`).
 */
export function visibleUserSql(alias: string = "users") {
  return sql.raw(`${alias}.hidden_at IS NULL`);
}
