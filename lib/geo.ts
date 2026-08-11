/**
 * Haversine distance in meters between two lat/lng points.
 * Used only server-side to decide whether a check-in is inside a venue's
 * verification_radius_m. Never expose raw coordinates back to the client.
 */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius, meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Confidence score in [0, 1] for a GPS verification, based on how far inside
 * (or outside) the venue's radius the reported position falls. This score is
 * stored for future multi-signal fusion (GPS + Wi-Fi + QR) but is never shown
 * to end users directly.
 */
export function gpsConfidenceScore(distance: number, radius: number): number {
  if (distance <= radius * 0.5) return 1;
  if (distance <= radius) return 0.75;
  if (distance <= radius * 1.5) return 0.25; // outside radius but plausibly GPS drift
  return 0;
}
