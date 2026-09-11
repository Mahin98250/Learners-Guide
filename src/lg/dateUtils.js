export const isoToday = () => new Date().toISOString().slice(0, 10);

export function relativeDate(value) {
  if (!value) return { primary: "No date", secondary: "" };
  const raw = String(value);
  const dateText = raw.length >= 10 ? raw.slice(0, 10) : raw;
  const date = new Date(dateText + "T00:00:00");
  if (Number.isNaN(date.getTime())) return { primary: dateText, secondary: "" };
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startDate.getTime() - startToday.getTime()) / 86400000);
  const formatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
  if (diffDays === 0) return { primary: "Today", secondary: formatter.format(date) };
  if (diffDays === -1) return { primary: "Yesterday", secondary: formatter.format(date) };
  if (diffDays === 1) return { primary: "Tomorrow", secondary: formatter.format(date) };
  if (diffDays < 0 && diffDays >= -6) return { primary: Math.abs(diffDays) + " days ago", secondary: formatter.format(date) };
  if (diffDays > 0 && diffDays <= 6) return { primary: "In " + diffDays + " days", secondary: formatter.format(date) };
  return { primary: formatter.format(date), secondary: "" };
}

export function dueState(value) {
  if (!value) return { key: "none", label: "No due date" };
  const raw = String(value).slice(0, 10);
  const date = new Date(raw + "T23:59:59");
  if (Number.isNaN(date.getTime())) return { key: "none", label: raw };
  const diff = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (diff < 0) { const days = Math.abs(diff); return { key: "overdue", label: days + " day" + (days === 1 ? "" : "s") + " overdue" }; }
  if (diff === 0) return { key: "today", label: "Due today" };
  if (diff === 1) return { key: "tomorrow", label: "Due tomorrow" };
  return { key: "upcoming", label: diff + " day" + (diff === 1 ? "" : "s") + " left" };
}
