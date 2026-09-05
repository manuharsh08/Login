/** Due-date formatting shared by the dashboard and admin assignment lists. */

/** Midnight today, so "due today" compares by calendar day, not by clock. */
function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Parses a `date` column ("2026-09-12") as a local calendar day.
 * `new Date("2026-09-12")` would parse as UTC midnight and can render as the
 * previous day for anyone west of Greenwich.
 */
export function parseDueDate(value) {
  if (!value) return null;

  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.valueOf()) ? null : date;
}

/**
 * Describes an assignment deadline.
 * @returns {{label: string, tone: "overdue"|"soon"|"ok"|"none", date: Date|null}}
 */
export function dueStatus(value) {
  const date = parseDueDate(value);
  if (!date) return { label: "No due date", tone: "none", date: null };

  const days = Math.round((date - startOfToday()) / 86400000);
  const formatted = date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });

  if (days < 0) {
    const overdue = Math.abs(days);
    return { label: `Overdue by ${overdue} day${overdue === 1 ? "" : "s"}`, tone: "overdue", date };
  }
  if (days === 0) return { label: "Due today", tone: "soon", date };
  if (days === 1) return { label: "Due tomorrow", tone: "soon", date };
  if (days <= 7) return { label: `Due in ${days} days`, tone: "soon", date };

  return { label: `Due ${formatted}`, tone: "ok", date };
}
