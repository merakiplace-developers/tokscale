import { format } from "date-fns";

export function formatLeaderboardDateRange(
  dateRange: { start: string; end: string } | null | undefined,
  timezone?: string
): string | null {
  if (!dateRange) return null;

  const parseDate = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const startDate = parseDate(dateRange.start);
  const endDate = parseDate(dateRange.end);

  let label: string;
  if (dateRange.start === dateRange.end) {
    label = format(startDate, "MMM d, yyyy");
  } else if (startDate.getFullYear() === endDate.getFullYear()) {
    label = `${format(startDate, "MMM d")} – ${format(endDate, "MMM d, yyyy")}`;
  } else {
    label = `${format(startDate, "MMM d, yyyy")} – ${format(endDate, "MMM d, yyyy")}`;
  }

  if (timezone) {
    label += ` (${timezone})`;
  }

  return label;
}
