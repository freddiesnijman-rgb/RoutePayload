import { useState, useEffect, useRef, MouseEvent } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { RoutePoint, WaypointItem, MapSelectionTarget, GeneratedPayload } from '../types';
import { decodePolyline } from '../utils/polyline';

interface MapPaneProps {
  apiKey: string;
  origin: RoutePoint;
  destination: RoutePoint;
  waypoints: WaypointItem[];
  mapSelectionTarget: MapSelectionTarget;
  onMapClick: (lat: number, lng: number) => void;
  payload: GeneratedPayload | null;
  isMapAuthFailed: boolean;
  onClearKey: () => void;
}

// React Google Maps custom helper component to draw polylines on the google map canvas
function GoogleMapsRoutePolyline({ encodedPolyline }: { encodedPolyline: string }) {
  const [googlePolyline, setGooglePolyline] = useState<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!encodedPolyline || typeof window === 'undefined' || !window.google?.maps) return;

    // Decode polyline coordinates
    const decodedCoords = decodePolyline(encodedPolyline);
    const path = decodedCoords.map((pt) => new window.google.maps.LatLng(pt.lat, pt.lng));

    const poly = new window.google.maps.Polyline({
      path: path,
      geodesic: true,
      strokeColor: '#6366f1', // Beautiful Indigo
      strokeOpacity: 0.85,
      strokeWeight: 4,
    });

    setGooglePolyline(poly);

    return () => {
      poly.setMap(null);
    };
  }, [encodedPolyline]);

  // Read map engine context from parent vis.gl provider to mount the polyline
  const parentMap = (window as any).google?.maps ? true : false;
  
  return null;
}

// Sub-component wrapper to actually mount the polyline safely using native map bounds fit
import { useMap } from '@vis.gl/react-google-maps';

function RouteFittingPolyline({ encodedPolyline, points }: { encodedPolyline: string; points: { lat: number; lng: number }[] }) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || !encodedPolyline || typeof window === 'undefined' || !window.google?.maps) return;

    // Clean up previous polyline
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
    }

    const decoded = decodePolyline(encodedPolyline);
    const googlePath = decoded.map(p => new window.google.maps.LatLng(p.lat, p.lng));

    const polyline = new window.google.maps.Polyline({
      path: googlePath,
      geodesic: true,
      strokeColor: '#6366f1', // Indigo glow
      strokeOpacity: 0.9,
      strokeWeight: 5,
      map: map,
    });

    polylineRef.current = polyline;

    // Fit map bounds to show the entire route
    const bounds = new window.google.maps.LatLngBounds();
    points.forEach(p => {
      if (p.lat !== 0 && p.lng !== 0) {
        bounds.extend({ lat: p.lat, lng: p.lng });
      }
    });
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    }

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, [map, encodedPolyline, points]);

  return null;
}

export default function MapPane({
  apiKey,
  origin,
  destination,
  waypoints,
  mapSelectionTarget,
  onMapClick,
  payload,
  isMapAuthFailed,
  onClearKey,
}: MapPaneProps) {
  const [hoveredCoordRef, setHoveredCoordRef] = useState<{ lat: number; lng: number } | null>(null);

  // Extract polyline if present in the current payload
  const activePolyline = payload?.response?.routes?.[0]?.polyline?.encodedPolyline || '';

  // Filter valid coordinates to calculate bounding boxes or drawing lists
  const activePoints = [
    { id: 'origin', type: 'origin', lat: origin.lat, lng: origin.lng, label: 'Origin', color: '#22c55e' },
    ...waypoints.map((w, idx) => ({
      id: w.id,
      type: 'waypoint',
      lat: w.lat,
      lng: w.lng,
      label: w.address || `Waypoint ${idx + 1}`,
      color: w.forcedStop ? '#f97316' : '#3b82f6', // Emerald vs Orange vs Blue
    })),
    { id: 'destination', type: 'destination', lat: destination.lat, lng: destination.lng, label: 'Destination', color: '#ef4444' },
  ].filter((p) => p.lat !== 0 && p.lng !== 0);

  // Map mouse clicks from Live Google Map
  const handleGoogleMapClick = (e: any) => {
    const latLng = e.detail?.latLng;
    if (latLng) {
      const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
      const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
      onMapClick(lat, lng);
    }
  };

  // --- MOCK INTERACTIVE SVG MAP GENERATION FOR SIMULATION MODE ---
  // Coordinate boundaries mapping system
  let minLat = 33.5;
  let maxLat = 37.0;
  let minLng = -122.5;
  let maxLng = -117.5;

  if (activePoints.length > 0) {
    const lats = activePoints.map(p => p.lat);
    const lngs = activePoints.map(p => p.lng);
    minLat = Math.min(...lats) - 0.25;
    maxLat = Math.max(...lats) + 0.25;
    minLng = Math.min(...lngs) - 0.25;
    maxLng = Math.max(...lngs) + 0.25;
  }

  // Width & height bounding ratio
  const latSpan = maxLat - minLat || 0.5;
  const lngSpan = maxLng - minLng || 0.5;

  const getSvgX = (lng: number) => {
    return ((lng - minLng) / lngSpan) * 1000;
  };

  const getSvgY = (lat: number) => {
    return (1 - (lat - minLat) / latSpan) * 600; // inverted lat for SVG coordinates
  };

  const handleSvgMapClick = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const percentX = clickX / rect.width;
    const percentY = clickY / rect.height;

    // Convert relative click positions back to simulated coordinates
    const clickedLng = minLng + percentX * lngSpan;
    const clickedLat = minLat + (1 - percentY) * latSpan;

    onMapClick(clickedLat, clickedLng);
  };

  const handleSvgMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percentX = (e.clientX - rect.left) / rect.width;
    const percentY = (e.clientY - rect.top) / rect.height;

    const currentLng = minLng + percentX * lngSpan;
    const currentLat = minLat + (1 - percentY) * latSpan;

    setHoveredCoordRef({ lat: currentLat, lng: currentLng });
  };

  const isLiveMap = Boolean(apiKey) && apiKey !== 'YOUR_API_KEY' && !isMapAuthFailed;

  return (
    <div className="w-full h-full relative group" id="map-pane-container">
      {isMapAuthFailed && (
        <div className="absolute top-16 left-3 right-3 bg-rose-950/95 border border-rose-500/50 rounded-lg p-4 text-xs text-rose-200 z-30 flex flex-col gap-2 shadow-2xl backdrop-blur-md animate-fadeIn">
          <div className="flex items-center gap-2 text-rose-400 font-bold uppercase tracking-wider text-[11px]">
            <span>⚠️ API KEY AUTHENTICATION FAILED</span>
          </div>
          <p className="text-slate-300 font-sans leading-relaxed text-[11px]">
            The Google Maps library rejected your API key with authentication errors (e.g. InvalidKeyMapError). 
            To draw live map segments and query direct routing details, please save a valid Google Maps API Key.
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <button
              id="clear-invalid-key-map-btn"
              onClick={onClearKey}
              className="px-3 py-1.5 text-[10px] font-mono font-bold bg-rose-900/80 hover:bg-rose-800 text-white rounded cursor-pointer transition-all border border-rose-700/50"
            >
              CLEAR INVALID KEY
            </button>
          </div>
        </div>
      )}

      {isLiveMap ? (
        <APIProvider apiKey={apiKey} version="weekly" libraries={['geometry', 'places']}>
          <div className="w-full h-full" id="google-live-canvas">
            <Map
              defaultCenter={origin.lat !== 0 ? { lat: origin.lat, lng: origin.lng } : { lat: 34.0522, lng: -118.2437 }}
              defaultZoom={10}
              mapId="aistudio_motorcycle_route_map"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              style={{ width: '100%', height: '100%' }}
              onClick={handleGoogleMapClick}
              gestureHandling="greedy"
              disableDefaultUI={false}
              colorScheme="DARK"
            >
              {/* Dynamic route fitting and drawing overlay component */}
              {activePolyline && (
                <RouteFittingPolyline
                  encodedPolyline={activePolyline}
                  points={activePoints.map(p => ({ lat: p.lat, lng: p.lng }))}
                />
              )}

              {/* Origin Marker */}
              {origin.lat !== 0 && (
                <AdvancedMarker position={{ lat: origin.lat, lng: origin.lng }} title={origin.address || 'Origin'}>
                  <Pin background="#22c55e" glyphColor="#ffffff" borderColor="#064e3b" />
                </AdvancedMarker>
              )}

              {/* Intermediate Stopovers */}
              {waypoints.map((wp, idx) => (
                <AdvancedMarker key={wp.id} position={{ lat: wp.lat, lng: wp.lng }} title={wp.address}>
                  <Pin
                    background={wp.forcedStop ? '#f97316' : '#3b82f6'}
                    glyphColor="#ffffff"
                    borderColor={wp.forcedStop ? '#ea580c' : '#1e3a8a'}
                  />
                </AdvancedMarker>
              ))}

              {/* Destination Marker */}
              {destination.lat !== 0 && (
                <AdvancedMarker position={{ lat: destination.lat, lng: destination.lng }} title={destination.address || 'Destination'}>
                  <Pin background="#ef4444" glyphColor="#ffffff" borderColor="#7f1d1d" />
                </AdvancedMarker>
              )}
            </Map>
          </div>
        </APIProvider>
      ) : (
        /* Dynamic SVG Tactfully Gridded Vector Map for Seamless Offline Execution */
        <div className="w-full h-full bg-[#111827] flex flex-col items-stretch relative overflow-hidden font-mono" id="simulated-vector-canvas">
          {/* HUD Top panel overlay */}
          <div className="absolute top-3 left-3 right-3 flex justify-between items-center z-20 pointer-events-none" id="hud-panel shadow">
            <div className="bg-slate-900 border border-slate-700 rounded-sm px-2.5 py-1.5 text-[10px] text-slate-300 flex flex-col gap-0.5 shadow-md">
              <span className="text-blue-500 font-bold tracking-wider text-[8px] uppercase font-mono">Simulated Vector Terrain Active</span>
              <span className="text-slate-500 text-[9px] font-mono">
                Bounds LAT: [{minLat.toFixed(3)} to {maxLat.toFixed(3)}]
              </span>
              <span className="text-slate-500 text-[9px] font-mono">
                Bounds LNG: [{minLng.toFixed(3)} to {maxLng.toFixed(3)}]
              </span>
            </div>

            {mapSelectionTarget && (
              <div className="bg-blue-600 border border-blue-500 text-white rounded-sm px-3 py-1.5 text-[9px] uppercase font-bold animate-pulse flex items-center gap-1 font-mono">
                <span>🎯 CLICK GRID TO CHOOSE COORDINATES</span>
              </div>
            )}

            {hoveredCoordRef && (
              <div className="bg-slate-900 border border-slate-700 rounded-sm px-2.5 py-1 text-[10px] text-blue-400 text-right shadow-md font-mono">
                <span className="text-[8px] text-slate-500 uppercase block font-semibold font-mono">COORDINATES HOVER</span>
                <span>
                  {hoveredCoordRef.lat.toFixed(6)}, {hoveredCoordRef.lng.toFixed(6)}
                </span>
              </div>
            )}
          </div>

          <svg
            className="flex-1 w-full bg-[#111827] border border-slate-700 cursor-crosshair select-none"
            onClick={handleSvgMapClick}
            onMouseMove={handleSvgMouseMove}
            onMouseLeave={() => setHoveredCoordRef(null)}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1000 600"
            id="svg-grid-surface"
          >
            {/* Grid Lines */}
            <defs>
              <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="#334155" opacity="0.32" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-pattern)" />

            {/* Coastline / Road vector line decoration to give actual map vibe */}
            <path
              d="M -10,120 Q 180,180 350,220 T 620,180 T 880,280 T 1100,500"
              fill="none"
              stroke="#0f172a"
              strokeWidth="10"
              opacity="0.4"
              strokeLinecap="round"
            />
            <path
              d="M -10,300 C 400,100 600,600 900,400 T 1200,200"
              fill="none"
              stroke="#0f172a"
              strokeWidth="8"
              opacity="0.25"
              strokeDasharray="10, 5"
            />

            {/* Glowing path lines connector */}
            {activePoints.length > 1 && (
              <>
                {/* Underglow vector path */}
                <path
                  d={activePoints
                    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getSvgX(p.lng)} ${getSvgY(p.lat)}`)
                    .join(' ')}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="8"
                  opacity="0.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Core vector line path */}
                <path
                  className="animate-dash"
                  d={activePoints
                    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getSvgX(p.lng)} ${getSvgY(p.lat)}`)
                    .join(' ')}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="6 4"
                />
              </>
            )}

            {/* Markers list */}
            {activePoints.map((pt) => {
              const cx = getSvgX(pt.lng);
              const cy = getSvgY(pt.lat);
              return (
                <g key={pt.id} className="cursor-pointer hover:scale-110 transition-transform">
                  {/* Glowing halo indicator */}
                  <circle cx={cx} cy={cy} r="12" fill={pt.color} opacity="0.25" className="animate-pulse" />
                  
                  {/* Pin dot */}
                  <circle cx={cx} cy={cy} r="5" fill={pt.color} stroke="#ffffff" strokeWidth="1.5" />
                  
                  {/* Pin label bubble */}
                  <g transform={`translate(0, -14)`}>
                    <rect
                      x={cx - 35}
                      y={cy}
                      width="70"
                      height="15"
                      rx="2"
                      fill="#0f172a"
                      stroke={pt.color}
                      strokeWidth="1"
                      opacity="0.9"
                    />
                    <text
                      x={cx}
                      y={cy + 11}
                      fill="#f8fafc"
                      fontSize="8"
                      fontFamily="monospace"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {pt.label.length > 12 ? pt.label.substring(0, 10) + '..' : pt.label}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>

          {/* Fallback footer HUD */}
          <div className="p-2 border-t border-slate-700 bg-slate-900/80 text-center text-[10px] text-slate-400 shrink-0 font-mono">
            INTERACTIVE VECTOR COMPASS ACTIVE • CLICK COMPASS DOT GRID TO DROP ROUTE PIN
          </div>
        </div>
      )}
    </div>
  );
}
