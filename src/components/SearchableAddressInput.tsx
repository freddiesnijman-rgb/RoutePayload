import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { Search, MapPin, Navigation, Compass } from 'lucide-react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

interface SearchableAddressInputProps {
  id: string;
  label: string;
  value: string;
  lat: number;
  lng: number;
  isMapTarget: boolean;
  onActivateMapClick: () => void;
  onAddressSelect: (address: string, lat: number, lng: number) => void;
  onCoordsChange: (lat: number, lng: number) => void;
  placeholder?: string;
  colorClass?: string;
}

export default function SearchableAddressInput({
  id,
  label,
  value,
  lat,
  lng,
  isMapTarget,
  onActivateMapClick,
  onAddressSelect,
  onCoordsChange,
  placeholder = 'Type address or search...',
  colorClass = 'text-emerald-400',
}: SearchableAddressInputProps) {
  const [addressVal, setAddressVal] = useState(value);
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const [localLat, setLocalLat] = useState(lat !== 0 ? lat.toString() : '');
  const [localLng, setLocalLng] = useState(lng !== 0 ? lng.toString() : '');

  useEffect(() => {
    const parsed = parseFloat(localLat);
    if (lat === 0) {
      if (localLat !== '') {
        setLocalLat('');
      }
    } else if (isNaN(parsed) || parsed !== lat) {
      setLocalLat(lat.toString());
    }
  }, [lat]);

  useEffect(() => {
    const parsed = parseFloat(localLng);
    if (lng === 0) {
      if (localLng !== '') {
        setLocalLng('');
      }
    } else if (isNaN(parsed) || parsed !== lng) {
      setLocalLng(lng.toString());
    }
  }, [lng]);

  // Load maps places library for Autocomplete
  const placesLib = useMapsLibrary('places');
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  useEffect(() => {
    setAddressVal(value);
  }, [value]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.google?.maps) {
      if (!autocompleteServiceRef.current && typeof window.google.maps.places?.AutocompleteService === 'function') {
        try {
          autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
        } catch (e) {
          console.warn("Could not construct AutocompleteService:", e);
        }
      }
      if (!geocoderRef.current && typeof window.google.maps.Geocoder === 'function') {
        try {
          geocoderRef.current = new window.google.maps.Geocoder();
        } catch (e) {
          console.warn("Could not construct Geocoder:", e);
        }
      }
    }
  }, [placesLib]);

  // Handle address input typing and fetch recommendations
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setAddressVal(text);

    if (!text || text.length < 3) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    let autocompleteService = autocompleteServiceRef.current;
    if (!autocompleteService && typeof window !== 'undefined' && window.google?.maps?.places) {
      autocompleteService = new window.google.maps.places.AutocompleteService();
      autocompleteServiceRef.current = autocompleteService;
    }

    if (!autocompleteService) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    autocompleteService.getPlacePredictions(
      { input: text },
      (preds, status) => {
        if (status === 'OK' && preds) {
          setPredictions(preds);
          setShowPredictions(true);
        } else {
          setPredictions([]);
          setShowPredictions(false);
        }
      }
    );
  };

  // Convert selected place prediction into latLng coordinates
  const handleSelectPrediction = (prediction: google.maps.places.AutocompletePrediction) => {
    const address = prediction.description;
    setAddressVal(address);
    setPredictions([]);
    setShowPredictions(false);

    let geocoder = geocoderRef.current;
    if (!geocoder && typeof window !== 'undefined' && typeof window.google?.maps?.Geocoder === 'function') {
      try {
        geocoder = new window.google.maps.Geocoder();
        geocoderRef.current = geocoder;
      } catch (e) {
        console.warn("Failed to construct Geocoder in handleSelectPrediction:", e);
      }
    }

    if (geocoder) {
      geocoder.geocode({ placeId: prediction.place_id }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const loc = results[0].geometry.location;
          onAddressSelect(address, loc.lat(), loc.lng());
        }
      });
    }
  };

  // Quick fallback set for manual inputs or simulating
  const handleManualCoordsSubmit = (type: 'lat' | 'lng', val: string) => {
    // Keep only numbers, dot, and minus sign
    const cleanVal = val.replace(/[^0-9.-]/g, '');

    if (type === 'lat') {
      setLocalLat(cleanVal);
      if (cleanVal === '') {
        onCoordsChange(0, lng);
      } else {
        const parsed = parseFloat(cleanVal);
        if (!isNaN(parsed)) {
          onCoordsChange(parsed, lng);
        }
      }
    } else {
      setLocalLng(cleanVal);
      if (cleanVal === '') {
        onCoordsChange(lat, 0);
      } else {
        const parsed = parseFloat(cleanVal);
        if (!isNaN(parsed)) {
          onCoordsChange(lat, parsed);
        }
      }
    }
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          let geocoder = geocoderRef.current;
          if (!geocoder && typeof window !== 'undefined' && typeof window.google?.maps?.Geocoder === 'function') {
            try {
              geocoder = new window.google.maps.Geocoder();
              geocoderRef.current = geocoder;
            } catch (e) {
              console.warn("Failed to construct Geocoder in GPS locator:", e);
            }
          }

          if (geocoder) {
            geocoder.geocode(
              { location: { lat: latitude, lng: longitude } },
              (results, status) => {
                if (status === 'OK' && results && results[0]) {
                  onAddressSelect(results[0].formatted_address, latitude, longitude);
                } else {
                  onAddressSelect(`Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`, latitude, longitude);
                }
              }
            );
          } else {
            onAddressSelect(`Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`, latitude, longitude);
          }
        },
        (error) => {
          console.warn('Geolocation failed:', error);
          onAddressSelect(`Current Location (Error GPS)`, 0, 0);
        }
      );
    }
  };

  const hasCoords = lat !== 0 || lng !== 0;

  return (
    <div className="flex flex-col gap-1.5" id={`address-input-wrapper-${id}`}>
      <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
        {label ? (
          <label className="flex items-center gap-1.5">
            <MapPin className={`w-3.5 h-3.5 ${colorClass}`} />
            <span className="label-tiny !mb-0 font-mono tracking-wider font-bold text-slate-300">{label}</span>
          </label>
        ) : (
          <div />
        )}
        
        <div className="flex items-center gap-2">
          <button
            id={`geolocate-btn-${id}`}
            type="button"
            onClick={handleGetCurrentLocation}
            className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-0.5 outline-none font-mono"
            title="Use current GPS latitude / longitude"
          >
            <Compass className="w-3 h-3" />
            <span>Use GPS</span>
          </button>
        </div>
      </div>

      <div className="relative" onFocus={() => setIsFocused(true)} onBlur={() => setTimeout(() => setIsFocused(false), 200)}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              id={`address-search-${id}`}
              type="text"
              value={addressVal}
              onChange={handleInputChange}
              placeholder={placeholder}
              className={`w-full bg-slate-900 text-slate-100 border pl-8 pr-3 py-1 text-xs transition-colors focus:outline-none ${
                isMapTarget
                  ? 'border-dashed border-sky-400 focus:border-sky-400 ring-2 ring-sky-950/40 shadow-sm shadow-sky-400 rounded'
                  : 'border-slate-700 focus:border-blue-500 rounded'
              }`}
            />
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          </div>

          <button
            id={`map-click-target-${id}`}
            type="button"
            onClick={onActivateMapClick}
            className={`px-2 py-1 text-[11px] font-medium rounded border transition-all flex items-center gap-1 ${
              isMapTarget
                ? 'bg-sky-500 border-sky-400 text-white animate-pulse shadow shadow-sky-500/25'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750 hover:border-slate-600'
            }`}
            title="Set this coordinates targeting by clicking a spot on the Google Map directly"
          >
            <Navigation className="w-3 h-3" />
            <span>{isMapTarget ? 'Click...' : 'Pin'}</span>
          </button>
        </div>

        {/* Prediction list container */}
        {showPredictions && isFocused && predictions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-850 border border-slate-700 rounded overflow-hidden shadow-xl z-50">
            {predictions.map((p) => (
              <button
                key={p.place_id}
                type="button"
                onMouseDown={() => handleSelectPrediction(p)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-750 text-slate-200 border-b border-slate-800 last:border-0 truncate flex items-center gap-1.5 transition-colors"
               id={`pred-${p.place_id}`}
              >
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>{p.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Latitude / longitude numbers layout inputs - useful for manual coordinate overrides or simulation */}
      <div className="grid grid-cols-2 gap-2 mt-1.5" id={`coordinates-layout-${id}`}>
        <div>
          <span className="text-[9px] text-slate-500 font-mono block mb-0.5 uppercase tracking-wider font-bold">Latitude</span>
          <input
            id={`latitude-input-${id}`}
            type="text"
            placeholder="e.g. 34.0522"
            value={localLat}
            onChange={(e) => handleManualCoordsSubmit('lat', e.target.value)}
            className="w-full bg-slate-900 border border-slate-705 text-slate-300 placeholder:text-slate-700 font-mono text-center rounded px-2 py-0.5 text-[11px] focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <span className="text-[9px] text-slate-500 font-mono block mb-0.5 uppercase tracking-wider font-bold">Longitude</span>
          <input
            id={`longitude-input-${id}`}
            type="text"
            placeholder="e.g. -118.2437"
            value={localLng}
            onChange={(e) => handleManualCoordsSubmit('lng', e.target.value)}
            className="w-full bg-slate-900 border border-slate-750 text-slate-300 placeholder:text-slate-700 font-mono text-center rounded px-2 py-0.5 text-[11px] focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
