import { useState, useEffect } from 'react';
import { RoutePoint, WaypointItem, MapSelectionTarget, GeneratedPayload } from './types';
import { generateMockPayload } from './utils/mockData';
import { encodePolyline } from './utils/polyline';
import KeyConfig from './components/KeyConfig';
import RouteSidebar from './components/RouteSidebar';
import MapPane from './components/MapPane';
import JsonViewer from './components/JsonViewer';
import { Compass, Sparkles, Navigation, Download, Smartphone, Laptop, X, Check } from 'lucide-react';

export default function App() {
  // Load API key from local storage, fallback to build-injected environment key
  const [apiKey, setApiKey] = useState<string>(() => {
    const saved = localStorage.getItem('motorcycle_api_key');
    if (saved) return saved;
    return (
      (process as any).env?.GOOGLE_MAPS_PLATFORM_KEY ||
      (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
      ''
    );
  });

  // Load initial states from local storage or fall back to preset values
  const [origin, setOrigin] = useState<RoutePoint>(() => {
    const saved = localStorage.getItem('motorcycle_route_origin');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      address: 'Sunset Boulevard, Los Angeles, CA',
      lat: 34.0980,
      lng: -118.3684,
    };
  });

  const [destination, setDestination] = useState<RoutePoint>(() => {
    const saved = localStorage.getItem('motorcycle_route_destination');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      address: 'Cannery Row, Monterey, CA',
      lat: 36.6172,
      lng: -121.9016,
    };
  });

  const [waypoints, setWaypoints] = useState<WaypointItem[]>(() => {
    const saved = localStorage.getItem('motorcycle_route_waypoints');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      {
        id: 'wp-preset-1',
        address: 'Pacific Coast Hwy, Santa Barbara, CA',
        lat: 34.4140,
        lng: -119.6931,
        forcedStop: true,
        stopDuration: 30, // Lunch break stop
      },
      {
        id: 'wp-preset-2',
        address: 'Pismo Beach Pier, Pismo Beach, CA',
        lat: 35.1394,
        lng: -120.6433,
        forcedStop: false,
        stopDuration: 15, // Scenic overlook stop
      },
      {
        id: 'wp-preset-3',
        address: 'McWay Falls, Big Sur, CA',
        lat: 36.1578,
        lng: -121.6721,
        forcedStop: true,
        stopDuration: 15, // Photo layover stop
      },
    ];
  });

  // Automatically persist route states back to local storage
  useEffect(() => {
    localStorage.setItem('motorcycle_route_origin', JSON.stringify(origin));
  }, [origin]);

  useEffect(() => {
    localStorage.setItem('motorcycle_route_destination', JSON.stringify(destination));
  }, [destination]);

  useEffect(() => {
    localStorage.setItem('motorcycle_route_waypoints', JSON.stringify(waypoints));
  }, [waypoints]);

  const [mapSelectionTarget, setMapSelectionTarget] = useState<MapSelectionTarget>(null);
  const [payload, setPayload] = useState<GeneratedPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMapAuthFailed, setIsMapAuthFailed] = useState(false);

  // Set up listener for Google Maps authentication failures
  useEffect(() => {
    (window as any).gm_authFailure = () => {
      console.warn('Google Maps API authentication failed (Invalid API Key).');
      setIsMapAuthFailed(true);
    };
    return () => {
      delete (window as any).gm_authFailure;
    };
  }, []);

  // Reset auth failed state when key is cleared or changed
  useEffect(() => {
    setIsMapAuthFailed(false);
  }, [apiKey]);

  // PWA installation states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  // Sync API Key state updates to local storage & reload window to enforce fresh Google maps script load
  const handleKeyChange = (newKey: string) => {
    const oldKey = localStorage.getItem('motorcycle_api_key') || '';
    const trimmedNew = newKey.trim();
    
    if (trimmedNew !== oldKey) {
      if (!trimmedNew || trimmedNew === '') {
        localStorage.removeItem('motorcycle_api_key');
      } else {
        localStorage.setItem('motorcycle_api_key', trimmedNew);
      }
      setApiKey(trimmedNew);
      
      // Clear output data on key changes
      setPayload(null);
      setError(null);
      setIsSimulated(false);
      
      // Refresh browser to cleanly re-mount Google Maps library with the new key (bypasses SDK multi-load crash)
      window.location.reload();
    }
  };

  // Factory reset to clean PCH presets
  const handleResetToDefaults = () => {
    localStorage.removeItem('motorcycle_route_origin');
    localStorage.removeItem('motorcycle_route_destination');
    localStorage.removeItem('motorcycle_route_waypoints');
    setOrigin({
      address: 'Sunset Boulevard, Los Angeles, CA',
      lat: 34.0980,
      lng: -118.3684,
    });
    setDestination({
      address: 'Cannery Row, Monterey, CA',
      lat: 36.6172,
      lng: -121.9016,
    });
    setWaypoints([
      {
        id: 'wp-preset-1',
        address: 'Pacific Coast Hwy, Santa Barbara, CA',
        lat: 34.4140,
        lng: -119.6931,
        forcedStop: true,
        stopDuration: 30,
      },
      {
        id: 'wp-preset-2',
        address: 'Pismo Beach Pier, Pismo Beach, CA',
        lat: 35.1394,
        lng: -120.6433,
        forcedStop: false,
        stopDuration: 15,
      },
      {
        id: 'wp-preset-3',
        address: 'McWay Falls, Big Sur, CA',
        lat: 36.1578,
        lng: -121.6721,
        forcedStop: true,
        stopDuration: 15,
      },
    ]);
    setPayload(null);
    setError(null);
    setIsSimulated(false);
  };

  // Perform Reverse Geocoding via standard fetch or fallback to coordinates formatting
  const handleMapClick = (lat: number, lng: number) => {
    if (!mapSelectionTarget) return;

    if (Boolean(apiKey) && apiKey !== 'YOUR_API_KEY' && (window as any).google?.maps?.Geocoder) {
      // Geolocate real address using Google Geocoder if maps is initialized
      try {
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
          let address = `Coordinates (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
          if (status === 'OK' && results && results[0]) {
            address = results[0].formatted_address;
          }
          setSelectionCoords(address, lat, lng);
        });
      } catch (e) {
        console.error('Geocoder initialization failed:', e);
        const simulatedLocStr = `Coordinates (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
        setSelectionCoords(simulatedLocStr, lat, lng);
      }
    } else {
      // Simulate/Format address name in simulated mode
      const simulatedLocStr = `Simulated Waypoint (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      setSelectionCoords(simulatedLocStr, lat, lng);
    }
  };

  const setSelectionCoords = (address: string, lat: number, lng: number) => {
    if (mapSelectionTarget?.type === 'origin') {
      setOrigin({ address, lat, lng });
    } else if (mapSelectionTarget?.type === 'destination') {
      setDestination({ address, lat, lng });
    } else if (mapSelectionTarget?.type === 'waypoint') {
      const targetId = mapSelectionTarget.id;
      setWaypoints((prev) =>
        prev.map((w) => (w.id === targetId ? { ...w, address, lat, lng } : w))
      );
    }
    setMapSelectionTarget(null);
  };

  // Trigger real-time post to Google Maps API via native client-side DirectionsService
  const handleGenerateRoute = async () => {
    if (!apiKey || apiKey === 'YOUR_API_KEY' || apiKey.trim() === '') {
      setError('An API Key is required to call the Google Routes service directly.\n\nPlease enter a valid Google Maps API Key in the "Google Maps API Key" field in the sidebar, or click the "SIMULATE MOCK JSON" button below to run the offline simulator.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsSimulated(false);

    // Form intermediate parameters matching Wayspoint specification
    const requestIntermediates = waypoints.map((item) => {
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

    const requestBody = {
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
      ...(requestIntermediates.length > 0 && { intermediates: requestIntermediates }),
    };

    try {
      if (!(window as any).google?.maps?.DirectionsService) {
        throw new Error(
          'Google Maps library is not fully loaded yet, or authentication failed due to an invalid API key. Please wait a moment, or verify your API key in the credential field above.\n\nAlternatively, click "SIMULATE MOCK JSON" to test the offline generator immediately.'
        );
      }

      const directionsService = new (window as any).google.maps.DirectionsService();

      const googleWaypoints = waypoints.map((wp) => ({
        location: new (window as any).google.maps.LatLng(wp.lat, wp.lng),
        stopover: true, // Generate separate legs to enable layover calculations
      }));

      directionsService.route(
        {
          origin: new (window as any).google.maps.LatLng(origin.lat, origin.lng),
          destination: new (window as any).google.maps.LatLng(destination.lat, destination.lng),
          waypoints: googleWaypoints,
          travelMode: (window as any).google.maps.TravelMode.DRIVING, // Motorcycle routing fallback on driving network
          optimizeWaypoints: false, // Keep user defined sequence
        },
        (result: any, status: any) => {
          setIsLoading(false);
          if (status === 'OK' && result) {
            try {
              const route = result.routes[0];
              
              // Extract/Encode the map overview path polyline
              let encodedPolyline = '';
              if ((window as any).google?.maps?.geometry?.encoding?.encodePath) {
                encodedPolyline = (window as any).google.maps.geometry.encoding.encodePath(route.overview_path);
              } else {
                encodedPolyline = encodePolyline(route.overview_path.map((p: any) => ({ lat: p.lat(), lng: p.lng() })));
              }

              // Build the corresponding legs according to Google Routes API v1 format
              const responseLegs = route.legs.map((leg: any, idx: number) => {
                const wpItem = waypoints[idx];
                const stopDurationSeconds = (wpItem && wpItem.forcedStop) ? wpItem.stopDuration * 60 : 0;
                const drivingSeconds = leg.duration?.value || 0;
                const legTotalSeconds = drivingSeconds + stopDurationSeconds;

                const legObj: any = {
                  distanceMeters: leg.distance?.value || 0,
                  duration: `${drivingSeconds}s`,
                  startLocation: {
                    latLng: {
                      latitude: leg.start_location.lat(),
                      longitude: leg.start_location.lng(),
                    },
                  },
                  endLocation: {
                    latLng: {
                      latitude: leg.end_location.lat(),
                      longitude: leg.end_location.lng(),
                    },
                  },
                  staticDuration: `${drivingSeconds}s`,
                };

                if (wpItem && wpItem.forcedStop) {
                  legObj.scheduledStop = {
                    name: wpItem.address || `Waypoint ${idx + 1}`,
                    duration: `${stopDurationSeconds}s`,
                  };
                  legObj.duration = `${legTotalSeconds}s`;
                }

                return legObj;
              });

              const totalDistanceMeters = route.legs.reduce((acc: number, l: any) => acc + (l.distance?.value || 0), 0);
              const totalDurationSeconds = route.legs.reduce((acc: number, l: any, idx: number) => {
                const wpItem = waypoints[idx];
                const stopDurationSeconds = (wpItem && wpItem.forcedStop) ? wpItem.stopDuration * 60 : 0;
                return acc + (l.duration?.value || 0) + stopDurationSeconds;
              }, 0);

              const routesResponse = {
                routes: [
                  {
                    legs: responseLegs,
                    distanceMeters: totalDistanceMeters,
                    duration: `${totalDurationSeconds}s`,
                    polyline: {
                      encodedPolyline,
                    },
                  },
                ],
              };

              setPayload({
                request: requestBody,
                response: routesResponse,
              });
              setIsSimulated(false);
            } catch (parseErr: any) {
              console.error(parseErr);
              setError(`Failed to process live directions into compliant JSON format: ${parseErr.message || parseErr}`);
            }
          } else {
            console.error('Directions request failed with status:', status);
            let userFriendlyMsg = `Directions calculation failed with status: [${status}].`;
            if (status === 'REQUEST_DENIED') {
              userFriendlyMsg += '\n\nThis usually indicates an Invalid/Restricted API Key, or that the "Directions API" is not enabled in your Google Cloud Developer Console. Make sure you enable the Directions API for your key!';
            } else if (status === 'ZERO_RESULTS') {
              userFriendlyMsg += '\n\nNo driving route could be found between those locations. Please double check that coordinates are reachable on road networks.';
            }
            setError(userFriendlyMsg);
          }
        }
      );
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred during client-side route calculation.');
      setIsLoading(false);
    }
  };

  // Run high-fidelity offline simulation
  const handleSimulateMock = () => {
    setIsLoading(true);
    setError(null);

    setTimeout(() => {
      try {
        const res = generateMockPayload(origin, destination, waypoints);
        setPayload(res);
        setIsSimulated(true);
      } catch (err: any) {
        setError('Simulation failed to build route math curves.');
      } finally {
        setIsLoading(false);
      }
    }, 500);
  };

  // PWA Service Worker Registration & Install Event Listeners
  useEffect(() => {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('PWA Service Worker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.error('PWA Service Worker registration failed:', err);
        });
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent browser's default prompt trigger
      e.preventDefault();
      // Store the event so we can call prompt() manually later
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Initial display-mode check
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User installation choice outcome: ${outcome}`);
      setDeferredPrompt(null);
      setIsInstallable(false);
    } else {
      // Show custom interactive step-by-step instructions
      setShowInstallGuide(true);
    }
  };

  // Generate initial simulation payload on load so the dashboard is immediately populated
  useEffect(() => {
    const res = generateMockPayload(origin, destination, waypoints);
    setPayload(res);
    setIsSimulated(true);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 flex flex-col font-sans" id="app-root-container">
      {/* Premium Dashboard Top Bar - Geometric Balance layout */}
      <header className="h-[56px] px-6 flex items-center justify-between border-b border-slate-700 bg-slate-900 shrink-0" id="app-header">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-blue-500/10 border border-slate-700 rounded flex items-center justify-center text-blue-500 font-bold group hover:rotate-12 transition-transform">
            <Compass className="w-5 h-5 text-blue-500 rotate-45 group-hover:rotate-90 transition-transform" />
          </div>
          <div className="flex items-center">
            <span className="font-bold tracking-[1px] text-sm uppercase">MOTO_ROUTE</span>
            <span className="text-blue-500 ml-1 font-light text-sm uppercase">PAYLOAD_GEN</span>
            <span className="hidden sm:inline text-[10px] text-slate-400 border-l border-slate-700 pl-3 ml-3 font-mono font-medium">
              CRITICAL ROUTING ENGINE v1
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Custom PWA Install / Download Button */}
          <button
            onClick={handleInstallClick}
            className={`flex items-center gap-2 text-[10px] font-mono border rounded px-3 py-1.5 transition-all outline-none cursor-pointer ${
              isInstalled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-indigo-600/10 hover:bg-indigo-600/20 border-indigo-500/30 text-indigo-400 hover:text-indigo-300'
            }`}
            title="Download/Install application as a standalone app"
          >
            {isInstalled ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold">APP INSTALLED</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 animate-bounce" />
                <span className="font-bold">INSTALL APP (PWA)</span>
              </>
            )}
          </button>

          <div className="hidden md:flex items-center gap-2 text-[10px] text-blue-500 font-mono bg-slate-800 border border-slate-700 rounded px-3 py-1">
            <Sparkles className="w-3 h-3 text-blue-500" />
            <span>PCH preset active</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="label-tiny !mb-0 font-mono text-[9px]">API Status:</span>
            <div className={`w-2.5 h-2.5 rounded-full ${apiKey ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          </div>
        </div>
      </header>

      {/* Main Grid Body - Split Screen Layout */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden" id="app-main-grid">
        {/* Left Sidebar (40% Width on desktop, full scrollable on mobile) */}
        <section className="w-full lg:w-[40%] xl:w-[35%] flex flex-col h-auto lg:h-full shrink-0 lg:overflow-hidden" id="grid-sidebar-wrapper">
          <RouteSidebar
            origin={origin}
            setOrigin={setOrigin}
            destination={destination}
            setDestination={setDestination}
            waypoints={waypoints}
            setWaypoints={setWaypoints}
            mapSelectionTarget={mapSelectionTarget}
            setMapSelectionTarget={setMapSelectionTarget}
            onGenerateRoute={handleGenerateRoute}
            onSimulateMock={handleSimulateMock}
            onResetToDefaults={handleResetToDefaults}
            isLoading={isLoading}
            isSimulating={isSimulated && isLoading}
          />
        </section>

        {/* Right Map & JSON Panel (60% Width on desktop, split vertically) */}
        <section className="w-full lg:flex-1 flex flex-col h-auto lg:h-full shrink-0 lg:overflow-hidden" id="grid-viewer-wrapper">
          {/* Top Panel: Configuration Input + Warning + Map Canvas */}
          <div className="w-full h-auto min-h-[500px] lg:h-[55%] flex flex-col border-b border-slate-700 shrink-0 lg:overflow-hidden" id="top-canvas-compartment">
            {/* Credentials / Status Banner */}
            <div className="p-3 bg-slate-900 border-b border-slate-700 shrink-0" id="credentials-banner-container">
              <KeyConfig
                apiKey={apiKey}
                onKeyChange={handleKeyChange}
                isSimulated={isSimulated}
              />
            </div>

            {/* Live or Tactical Map display */}
            <div className="flex-1 relative min-h-[350px]" id="relative-map-container">
              <MapPane
                apiKey={apiKey}
                origin={origin}
                destination={destination}
                waypoints={waypoints}
                mapSelectionTarget={mapSelectionTarget}
                onMapClick={handleMapClick}
                payload={payload}
                isMapAuthFailed={isMapAuthFailed}
                onClearKey={() => handleKeyChange('')}
              />
            </div>
          </div>

          {/* Bottom Panel: Syntax-Highlighted JSON viewer */}
          <div className="w-full h-[450px] lg:h-[45%] bg-[#020617] shrink-0 lg:overflow-hidden text-slate-200" id="bottom-code-compartment">
            <JsonViewer payload={payload} error={error} />
          </div>
        </section>
      </main>

      {/* Dynamic PWA Installation Guide Modal */}
      {showInstallGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4" id="pwa-guide-modal">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl relative" id="pwa-modal-content">
            <button
              onClick={() => setShowInstallGuide(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 transition-colors focus:outline-none cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header / Logo Icon */}
            <div className="flex items-center gap-3.5 mb-5">
              <div className="h-12 w-12 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <img src="/pwa-icon.svg" alt="App Logo" className="w-10 h-10 object-contain" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white tracking-wide uppercase">Download Route Planner</h3>
                <p className="text-[10px] font-mono text-slate-400">PROGRESSIVE WEB APP (PWA)</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              Install this app directly on your mobile home screen or computer desktop to run it like a native standalone application with fast loading speeds, offline storage cache, and zero browser url bars.
            </p>

            {/* Instructions container */}
            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3 bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                <div className="p-1.5 bg-indigo-500/10 rounded text-indigo-400 shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white mb-1">On Mobile (iOS or Android)</h4>
                  <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside">
                    <li><strong className="text-slate-300">iOS (Safari)</strong>: Tap the <strong className="text-indigo-400">Share</strong> button and choose <strong className="text-white">"Add to Home Screen"</strong>.</li>
                    <li><strong className="text-slate-300">Android (Chrome)</strong>: Tap the menu icon and choose <strong className="text-white">"Install app"</strong> or <strong className="text-white">"Add to Home Screen"</strong>.</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                <div className="p-1.5 bg-blue-500/10 rounded text-blue-400 shrink-0">
                  <Laptop className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white mb-1">On Desktop (Chrome or Edge)</h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Click the <strong className="text-blue-400">App Install icon</strong> (represented as a monitor/down-arrow) right in your browser's address bar to install immediately.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 font-mono">
              <button
                onClick={() => setShowInstallGuide(false)}
                className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Close
              </button>
              {isInstallable && (
                <button
                  onClick={() => {
                    setShowInstallGuide(false);
                    handleInstallClick();
                  }}
                  className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Install Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
