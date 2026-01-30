export function formatMinutesAgo(date: Date, now = new Date()) {
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes <= 0) {
    return "Updated just now";
  }
  return `Updated ${minutes} min ago`;
}

export function formatExpiresIn(date: Date, now = new Date()) {
  const diffMs = date.getTime() - now.getTime();
  const minutes = Math.ceil(diffMs / 60000);
  if (minutes <= 0) {
    return "Expired";
  }
  return `Expires in ${minutes} min`;
}
