export interface WaypointItem {
  id: string;
  address: string;
  lat: number;
  lng: number;
  forcedStop: boolean;
  stopDuration: number; // stop duration in minutes
}

export interface RoutePoint {
  address: string;
  lat: number;
  lng: number;
}

export type MapSelectionTarget =
  | { type: 'origin' }
  | { type: 'destination' }
  | { type: 'waypoint'; id: string }
  | null;

export interface GeneratedPayload {
  request: {
    origin: {
      location: {
        latLng: {
          latitude: number;
          longitude: number;
        };
      };
    };
    destination: {
      location: {
        latLng: {
          latitude: number;
          longitude: number;
        };
      };
    };
    intermediates?: Array<{
      location: {
        latLng: {
          latitude: number;
          longitude: number;
        };
      };
      via?: boolean;
      vehicleStopover?: boolean;
      stopDuration?: string;
    }>;
    travelMode: 'TWO_WHEELER';
    routingPreference: 'TRAFFIC_AWARE';
  };
  response: any;
}
