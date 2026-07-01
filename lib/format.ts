/** Format kobo as Nigerian Naira (100 kobo = ₦1). */
export function formatNGN(kobo: number): string {
  return (kobo / 100).toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  });
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleString("en-NG", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
