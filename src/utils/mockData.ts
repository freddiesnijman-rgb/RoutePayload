import { WaypointItem, RoutePoint, GeneratedPayload } from '../types';
import { encodePolyline } from './polyline';

// Simple Haversine helper to calculate distance between two coordinates in meters
export function calculateHaversineDistance(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number }
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (p1.lat * Math.PI) / 180;
  const phi2 = (p2.lat * Math.PI) / 180;
  const deltaPhi = ((p2.lat - p1.lat) * Math.PI) / 180;
  const deltaLambda = ((p2.lng - p1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// Generates winding curves between points so that the mock motorcycle path looks realistic on the map
export function generateWindingPath(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number }
): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  const steps = 15; // Number of intermediate points for curves
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let lat = p1.lat + (p2.lat - p1.lat) * t;
    let lng = p1.lng + (p2.lng - p1.lng) * t;

    // Add curvy offsets to make it look like a secondary, winding mountain/coastal road
    if (i > 0 && i < steps) {
      const frequency = Math.PI * 2.5; // sine wave peaks
      const amplitude = 0.008; // curve width in degrees
      const sinOffset = Math.sin(t * frequency) * amplitude;

      // Compute perpendicular offset direction
      const dLat = p2.lat - p1.lat;
      const dLng = p2.lng - p1.lng;
      const distance = Math.sqrt(dLat * dLat + dLng * dLng);

      if (distance > 0) {
        lat += (-dLng / distance) * sinOffset;
        lng += (dLat / distance) * sinOffset;
      }
    }
    points.push({ lat, lng });
  }
  return points;
}

/**
 * Computes a fully formatted simulated API request payload and response JSON
 * matching the Google Maps Routes v1 computeRoutes specification.
 */
export function generateMockPayload(
  origin: RoutePoint,
  destination: RoutePoint,
  intermediates: WaypointItem[]
): GeneratedPayload {
  // Construct all legs including intermediates
  const fullSeq: { lat: number; lng: number; label: string; forcedStop: boolean; stopDuration: number }[] = [
    { ...origin, label: origin.address || 'Origin', forcedStop: false, stopDuration: 0 },
    ...intermediates.map((item, idx) => ({
      lat: item.lat,
      lng: item.lng,
      label: item.address || `Waypoint ${idx + 1}`,
      forcedStop: item.forcedStop,
      stopDuration: item.stopDuration,
    })),
    { ...destination, label: destination.address || 'Destination', forcedStop: false, stopDuration: 0 },
  ];

  // Intermediates for request payload
  const requestIntermediates = intermediates.map((item) => {
    const waypoint: any = {
      location: {
        latLng: {
          latitude: item.lat,
          longitude: item.lng,
        },
      },
    };
    if (item.forcedStop) {
      waypoint.via = false;
      waypoint.vehicleStopover = true;
      waypoint.stopDuration = `${item.stopDuration * 60}s`;
    } else {
      waypoint.via = true;
      waypoint.vehicleStopover = false;
    }
    return waypoint;
  });

  // Assemble full visual polyline coordinates
  const fullCoordinates: { lat: number; lng: number }[] = [];
  const legs: any[] = [];
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;

  for (let i = 0; i < fullSeq.length - 1; i++) {
    const start = fullSeq[i];
    const end = fullSeq[i + 1];

    // Curve interpolation for coordinate path drawing
    const legCoords = generateWindingPath(start, end);
    // Avoid duplicating start points
    if (i === 0) {
      fullCoordinates.push(...legCoords);
    } else {
      fullCoordinates.push(...legCoords.slice(1));
    }

    // Calculations for the current leg
    const distanceMeters = calculateHaversineDistance(start, end);
    // Typical average speed on curvy motorcycle route ~ 65 km/h = 18 m/s
    const drivingSeconds = Math.round(distanceMeters / 18);
    
    // Add forced stop duration if the end waypoint has a forced stop layover configured
    const stopDurationSeconds = end.forcedStop ? end.stopDuration * 60 : 0;
    const legTotalSeconds = drivingSeconds + stopDurationSeconds;

    totalDistanceMeters += distanceMeters;
    totalDurationSeconds += legTotalSeconds;

    const legObject: any = {
      distanceMeters,
      duration: `${drivingSeconds}s`,
      startLocation: {
        latLng: {
          latitude: start.lat,
          longitude: start.lng,
        },
      },
      endLocation: {
        latLng: {
          latitude: end.lat,
          longitude: end.lng,
        },
      },
      staticDuration: `${drivingSeconds}s`,
    };

    if (end.forcedStop) {
      legObject.scheduledStop = {
        name: end.label,
        duration: `${stopDurationSeconds}s`,
      };
      // Keep overall duration updated with stop Layover duration
      legObject.duration = `${legTotalSeconds}s`;
    }

    legs.push(legObject);
  }

  const encodedPoly = encodePolyline(fullCoordinates);

  // Schema-correct request body
  const requestPayload: any = {
    origin: {
      location: {
        latLng: {
          latitude: origin.lat,
          longitude: origin.lng,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: destination.lat,
          longitude: destination.lng,
        },
      },
    },
    travelMode: 'TWO_WHEELER',
    routingPreference: 'TRAFFIC_AWARE',
  };

  if (requestIntermediates.length > 0) {
    requestPayload.intermediates = requestIntermediates;
  }

  // Schema-correct response body
  const responsePayload: any = {
    routes: [
      {
        legs,
        distanceMeters: totalDistanceMeters,
        duration: `${totalDurationSeconds}s`,
        polyline: {
          encodedPolyline: encodedPoly,
        },
      },
    ],
  };

  return {
    request: requestPayload,
    response: responsePayload,
  };
}
