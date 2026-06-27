import { MapPin, Plus, ArrowUp, ArrowDown, Trash2, Clock, Zap, Map, RotateCcw } from 'lucide-react';
import { WaypointItem, RoutePoint, MapSelectionTarget } from '../types';
import SearchableAddressInput from './SearchableAddressInput';

interface RouteSidebarProps {
  origin: RoutePoint;
  setOrigin: (pt: RoutePoint) => void;
  destination: RoutePoint;
  setDestination: (pt: RoutePoint) => void;
  waypoints: WaypointItem[];
  setWaypoints: (pts: WaypointItem[]) => void;
  mapSelectionTarget: MapSelectionTarget;
  setMapSelectionTarget: (target: MapSelectionTarget) => void;
  onGenerateRoute: () => void;
  onSimulateMock: () => void;
  onResetToDefaults: () => void;
  isLoading: boolean;
  isSimulating: boolean;
}

export default function RouteSidebar({
  origin,
  setOrigin,
  destination,
  setDestination,
  waypoints,
  setWaypoints,
  mapSelectionTarget,
  setMapSelectionTarget,
  onGenerateRoute,
  onSimulateMock,
  onResetToDefaults,
  isLoading,
  isSimulating,
}: RouteSidebarProps) {

  const handleAddWaypoint = () => {
    if (waypoints.length >= 10) return;

    // Create a default waypoint at Los Angeles center with random tiny offset so it doesn't pile up
    const randomOffsetLat = (Math.random() - 0.5) * 0.05;
    const randomOffsetLng = (Math.random() - 0.5) * 0.05;
    const baseLat = origin.lat !== 0 ? origin.lat : 34.0522;
    const baseLng = origin.lng !== 0 ? origin.lng : -118.2437;

    const newWp: WaypointItem = {
      id: crypto.randomUUID(),
      address: `Waypoint ${waypoints.length + 1}`,
      lat: baseLat + randomOffsetLat,
      lng: baseLng + randomOffsetLng,
      forcedStop: false,
      stopDuration: 15, // Default to 15 mins
    };

    setWaypoints([...waypoints, newWp]);
  };

  const handleRemoveWaypoint = (id: string) => {
    setWaypoints(waypoints.filter((w) => w.id !== id));
    // Clear Map Targeting if removing that active waypoint
    if (mapSelectionTarget?.type === 'waypoint' && mapSelectionTarget.id === id) {
      setMapSelectionTarget(null);
    }
  };

  const updateWaypointItem = (id: string, fields: Partial<WaypointItem>) => {
    setWaypoints(
      waypoints.map((w) => (w.id === id ? { ...w, ...fields } : w))
    );
  };

  const moveWaypointIndex = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= waypoints.length) return;

    const updated = [...waypoints];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setWaypoints(updated);
  };

  const handleCoordinateSelect = (
    target: 'origin' | 'destination' | string,
    address: string,
    lat: number,
    lng: number
  ) => {
    if (target === 'origin') {
      setOrigin({ address, lat, lng });
    } else if (target === 'destination') {
      setDestination({ address, lat, lng });
    } else {
      updateWaypointItem(target, { address, lat, lng });
    }
    // Automatically turn off map targeting
    setMapSelectionTarget(null);
  };

  const handleCoordsChange = (
    target: 'origin' | 'destination' | string,
    lat: number,
    lng: number
  ) => {
    if (target === 'origin') {
      setOrigin({ ...origin, lat, lng });
    } else if (target === 'destination') {
      setDestination({ ...destination, lat, lng });
    } else {
      updateWaypointItem(target, { lat, lng });
    }
  };

  return (
    <div className="w-full flex flex-col h-auto lg:h-full bg-slate-900 border-r border-slate-705 text-slate-100 p-5 shrink-0 lg:overflow-y-auto" id="route-sidebar">
      {/* Title */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-blue-500" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-100 font-mono">
            Route Configurator
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            id="reset-route-btn"
            type="button"
            onClick={onResetToDefaults}
            className="text-[10px] sm:text-[9px] font-mono text-slate-400 hover:text-rose-400 bg-slate-800 hover:bg-rose-950/20 border border-slate-700 hover:border-rose-900/40 px-3.5 sm:px-2 py-1.5 sm:py-0.5 rounded transition-all cursor-pointer flex items-center gap-1"
            title="Reset stops and addresses back to default California PCH presets"
          >
            <RotateCcw className="w-3 h-3" />
            <span>RESET</span>
          </button>
          <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded">
            v1.0.5
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 flex-1 pb-6" id="sidebar-inputs-list">
        {/* Origin */}
        <div className="bg-slate-900/40 border border-slate-700 p-3 rounded" id="origin-section-wrapper">
          <SearchableAddressInput
            id="origin"
            label="Origin (Start Location)"
            value={origin.address}
            lat={origin.lat}
            lng={origin.lng}
            isMapTarget={mapSelectionTarget?.type === 'origin'}
            onActivateMapClick={() => setMapSelectionTarget({ type: 'origin' })}
            onAddressSelect={(address, lat, lng) => handleCoordinateSelect('origin', address, lat, lng)}
            onCoordsChange={(lat, lng) => handleCoordsChange('origin', lat, lng)}
            placeholder="Search Origin e.g. Los Angeles"
            colorClass="text-emerald-500"
          />
        </div>

        {/* Dynamic Waypoints */}
        <div className="flex flex-col gap-2.5" id="intermediates-list-section">
          <div className="flex justify-between items-center px-1">
            <span className="label-tiny !mb-0 font-bold font-mono">
              Waypoints ({waypoints.length} / 10)
            </span>
            <button
              id="add-waypoint-btn"
              type="button"
              disabled={waypoints.length >= 10}
              onClick={handleAddWaypoint}
              className="btn btn-secondary !py-1 !px-2.5 !text-[11px]"
            >
              <Plus className="w-3.5 h-3.5 text-blue-500" />
              <span>Add Stop</span>
            </button>
          </div>

          <div className="flex flex-col gap-2" id="waypoints-drag-pool">
            {waypoints.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-700 rounded text-xs text-slate-500 font-mono">
                No intermediate waypoints added.
              </div>
            ) : (
              waypoints.map((item, index) => {
                const isSelectedForMap =
                  mapSelectionTarget?.type === 'waypoint' && mapSelectionTarget.id === item.id;
                return (
                  <div
                    key={item.id}
                    className="waypoint-row"
                    id={`waypoint-card-${item.id}`}
                  >
                    {/* Header Controls */}
                    <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
                      <span className="font-mono">{`Waypoint ${index + 1}`}</span>

                      <div className="flex items-center gap-1">
                        <button
                          id={`move-up-wp-${item.id}`}
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveWaypointIndex(index, 'up')}
                          className="p-1 hover:bg-slate-700 text-slate-400 hover:text-slate-100 rounded disabled:opacity-20 transition-colors"
                          title="Move Waypoint Up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          id={`move-down-wp-${item.id}`}
                          type="button"
                          disabled={index === waypoints.length - 1}
                          onClick={() => moveWaypointIndex(index, 'down')}
                          className="p-1 hover:bg-slate-700 text-slate-400 hover:text-slate-100 rounded disabled:opacity-20 transition-colors"
                          title="Move Waypoint Down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          id={`delete-wp-${item.id}`}
                          type="button"
                          onClick={() => handleRemoveWaypoint(item.id)}
                          className="p-1 hover:bg-rose-950 text-rose-400 hover:text-rose-300 rounded transition-colors"
                          title="Delete Waypoint"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Geocomplete / Map input */}
                    <SearchableAddressInput
                      id={item.id}
                      label=""
                      value={item.address}
                      lat={item.lat}
                      lng={item.lng}
                      isMapTarget={isSelectedForMap}
                      onActivateMapClick={() => setMapSelectionTarget({ type: 'waypoint', id: item.id })}
                      onAddressSelect={(address, lat, lng) => handleCoordinateSelect(item.id, address, lat, lng)}
                      onCoordsChange={(lat, lng) => handleCoordsChange(item.id, lat, lng)}
                      placeholder={`Search Address for Waypoint ${index + 1}`}
                      colorClass="text-blue-500"
                    />

                    {/* Forced Stop Layout */}
                    <div className="pt-2 border-t border-slate-700/60 flex flex-col gap-2">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                        <input
                          id={`forced-stop-toggle-${item.id}`}
                          type="checkbox"
                          checked={item.forcedStop}
                          onChange={(e) => updateWaypointItem(item.id, { forcedStop: e.target.checked })}
                          className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-blue-550 focus:ring-opacity-40 focus:ring-blue-500 focus:ring-2"
                        />
                        <span>Forced Stop / Layover Stopover</span>
                      </label>

                      {item.forcedStop && (
                        <div className="bg-slate-900/90 border border-slate-700 rounded p-2.5 flex flex-col gap-1.5 animate-fadeIn">
                          <div className="flex justify-between items-center text-[10px] text-slate-400">
                            <span className="flex items-center gap-1 font-medium select-none">
                              <Clock className="w-3 h-3 text-orange-500" />
                              <span className="font-mono text-[9px] uppercase tracking-wider">Stop Duration:</span>
                            </span>
                            <span className="font-mono text-orange-400 font-bold">
                              {item.stopDuration} mins ({item.stopDuration * 60}s)
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500">5m</span>
                            <input
                              id={`stop-duration-slider-${item.id}`}
                              type="range"
                              min="5"
                              max="180"
                              step="5"
                              value={item.stopDuration}
                              onChange={(e) => updateWaypointItem(item.id, { stopDuration: parseInt(e.target.value) })}
                              className="flex-1 h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-blue-500"
                            />
                            <span className="text-[10px] text-slate-500">180m</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Destination */}
        <div className="bg-slate-900/40 border border-slate-700 p-3 rounded" id="destination-section-wrapper">
          <SearchableAddressInput
            id="destination"
            label="Destination (End Location)"
            value={destination.address}
            lat={destination.lat}
            lng={destination.lng}
            isMapTarget={mapSelectionTarget?.type === 'destination'}
            onActivateMapClick={() => setMapSelectionTarget({ type: 'destination' })}
            onAddressSelect={(address, lat, lng) => handleCoordinateSelect('destination', address, lat, lng)}
            onCoordsChange={(lat, lng) => handleCoordsChange('destination', lat, lng)}
            placeholder="Search Destination e.g. Monterey"
            colorClass="text-rose-500"
          />
        </div>
      </div>

      {/* Generation Control Buttons */}
      <div className="bg-slate-900 border-t border-slate-700 pt-3 flex flex-col gap-2 shrink-0 sticky bottom-0" id="route-sidebar-footer">
        {mapSelectionTarget && (
          <div className="text-[10px] text-blue-400 font-bold font-mono text-center bg-slate-800 border border-slate-700 rounded py-1 px-1.5 animate-pulse">
            🎯 CLICK COMPASS GRID SPOT TO PIN STOP
          </div>
        )}

        <button
          id="btn-generate-route"
          type="button"
          disabled={isLoading || origin.lat === 0 || destination.lat === 0}
          onClick={onGenerateRoute}
          className="btn btn-primary w-full justify-center h-10 uppercase font-mono tracking-wider"
        >
          {isLoading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Querying Routes API...</span>
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5 text-yellow-300 fill-current" />
              <span>Generate Route Payload</span>
            </>
          )}
        </button>

        <button
          id="btn-simulate-route"
          type="button"
          disabled={isSimulating || origin.lat === 0 || destination.lat === 0}
          onClick={onSimulateMock}
          className="btn btn-secondary w-full justify-center h-9 uppercase font-mono tracking-wider"
        >
          {isSimulating ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-slate-500 border-t-slate-300 rounded-full animate-spin" />
              <span>Simulating...</span>
            </>
          ) : (
            <span>Simulate Mock JSON (Offline)</span>
          )}
        </button>
      </div>
    </div>
  );
}
