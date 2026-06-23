// Dates are stored at UTC midnight; format/parse in UTC to avoid off-by-one.
export function formatDueDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}
