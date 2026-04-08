import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Navigation } from "@/components/layout/Navigation";
import { LeaderboardSkeleton } from "@/components/Skeleton";
import { getLeaderboardData, getUserRank } from "@/lib/leaderboard/getLeaderboard";
import type { SortBy } from "@/lib/leaderboard/types";
import { getSession } from "@/lib/auth/session";
import { SORT_BY_COOKIE_NAME, isValidSortBy } from "@/lib/leaderboard/constants";
import LeaderboardClient from "./LeaderboardClient";

export default async function LeaderboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/leaderboard");
  }
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-bg-default)",
      }}
    >
      <Navigation />

      <main className="main-container" style={{ paddingTop: 80 }}>
        <Suspense fallback={<LeaderboardSkeleton />}>
          <LeaderboardWithPreferences />
        </Suspense>
      </main>
    </div>
  );
}

async function LeaderboardWithPreferences() {
  const cookieStore = await cookies();
  const sortByCookie = cookieStore.get(SORT_BY_COOKIE_NAME)?.value;
  const sortBy: SortBy = isValidSortBy(sortByCookie) ? sortByCookie : "tokens";

  const [initialData, session] = await Promise.all([
    getLeaderboardData("all", 1, 50, sortBy),
    getSession(),
  ]);

  // session is guaranteed by the auth guard in LeaderboardPage
  const initialUserRank = await getUserRank(session!.username, "all", sortBy);

  return (
    <LeaderboardClient
      initialData={initialData}
      currentUser={session}
      initialSortBy={sortBy}
      initialUserRank={initialUserRank}
    />
  );
}
