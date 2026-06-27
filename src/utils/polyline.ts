/**
 * Decodes a Google Maps encoded polyline string into an array of lat/lng coordinate pairs.
 * This is useful for drawing polylines offline or as a fallback when the Google Maps drawing libraries aren't ready.
 */
export function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push({
      lat: lat * 1e-5,
      lng: lng * 1e-5,
    });
  }

  return points;
}

/**
 * Encodes an array of lat/lng coordinate pairs into a Google Maps encoded polyline string.
 */
export function encodePolyline(points: { lat: number; lng: number }[]): string {
  let encoded = '';
  let lastLat = 0;
  let lastLng = 0;

  const encodeSignedNumber = (num: number) => {
    let sgnNum = num << 1;
    if (num < 0) {
      sgnNum = ~sgnNum;
    }
    let out = '';
    while (sgnNum >= 0x20) {
      out += String.fromCharCode((0x20 | (sgnNum & 0x1f)) + 63);
      sgnNum >>= 5;
    }
    out += String.fromCharCode(sgnNum + 63);
    return out;
  };

  for (const point of points) {
    const latVal = Math.round(point.lat * 1e5);
    const lngVal = Math.round(point.lng * 1e5);

    encoded += encodeSignedNumber(latVal - lastLat);
    encoded += encodeSignedNumber(lngVal - lastLng);

    lastLat = latVal;
    lastLng = lngVal;
  }

  return encoded;
}

