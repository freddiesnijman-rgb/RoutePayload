import { useState, useEffect, FormEvent } from 'react';
import { Eye, EyeOff, Check, Key, ShieldAlert, BadgeCheck } from 'lucide-react';

interface KeyConfigProps {
  apiKey: string;
  onKeyChange: (key: string) => void;
  isSimulated: boolean;
}

export default function KeyConfig({ apiKey, onKeyChange, isSimulated }: KeyConfigProps) {
  const [inputKey, setInputKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Sync internal state if parent key changes (e.g., cleared)
  useEffect(() => {
    setInputKey(apiKey);
  }, [apiKey]);

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = inputKey.trim();
    onKeyChange(trimmed);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleClear = () => {
    setInputKey('');
    onKeyChange('');
  };

  const hasKey = Boolean(apiKey);

  return (
    <div className="w-full flex flex-col gap-2.5" id="key-config-container">
      {/* Top Input Bar */}
      <form
        onSubmit={handleSave}
        className="w-full flex flex-wrap items-center gap-3 bg-slate-900 border border-slate-700/80 rounded p-3 text-slate-100"
        id="api-key-form"
      >
        <div className="flex items-center gap-1.5 text-slate-400">
          <Key className="w-4 h-4 text-blue-500" />
          <span className="label-tiny !mb-0 font-mono font-bold">
            CREDENTIALS:
          </span>
        </div>

        <div className="flex-1 min-w-[180px] relative">
          <input
            id="api-key-input"
            type={showKey ? 'text' : 'password'}
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            placeholder="AI Studio Secrets active or Paste your custom API key..."
            className="input-field text-xs font-mono !py-1"
          />
          <button
            id="toggle-pass-visibility"
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-100 transition-colors"
            title={showKey ? 'Hide key' : 'Show key'}
          >
            {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="save-key-btn"
            type="submit"
            className={`btn py-1.5 px-3 text-xs ${
              isSaved
                ? 'bg-emerald-600 text-white'
                : 'btn-primary'
            }`}
          >
            {isSaved ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Saved!</span>
              </>
            ) : (
              <span>Save Key</span>
            )}
          </button>
          
          {hasKey && (
            <button
              id="clear-key-btn"
              type="button"
              onClick={handleClear}
              className="btn py-1.5 px-3 text-xs bg-rose-950/20 hover:bg-rose-900/40 border border-rose-500/30 text-rose-400 hover:text-rose-300 rounded transition-colors cursor-pointer"
            >
              Clear Key
            </button>
          )}
          
          {hasKey && (
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium px-2 py-1 bg-slate-800 border border-slate-700 rounded">
              <BadgeCheck className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="font-mono tracking-wider font-bold">ACTIVE</span>
            </div>
          )}
        </div>
      </form>

      {/* Warning/Status Banner */}
      {!hasKey ? (
        <div
          id="warning-banner"
          className="flex items-start gap-3 bg-slate-800 border border-slate-700 text-slate-300 rounded p-3 text-xs animate-fadeIn"
        >
          <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 flex flex-col gap-0.5">
            <span className="font-bold text-[11px] text-amber-500 uppercase tracking-widest font-mono">
              Simulation Mode Active
            </span>
            <p className="text-slate-400 leading-normal">
              To queries live routing details, input your Google Maps Key above. Otherwise, enjoy offline mock testing!
            </p>
          </div>
        </div>
      ) : isSimulated ? (
        <div
          id="simulation-alert-banner"
          className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 text-blue-400 rounded px-3.5 py-1.5 text-xs font-mono"
        >
          <BadgeCheck className="w-3.5 h-3.5 text-blue-500 animate-spin" />
          <span>Showing simulated PCH route. Click "Generate Route" to hit live API.</span>
        </div>
      ) : null}
    </div>
  );
}
