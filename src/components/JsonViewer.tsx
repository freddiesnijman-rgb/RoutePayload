import { useState, useEffect } from 'react';
import { Copy, Check, Download, FileJson, AlertCircle } from 'lucide-react';
import { GeneratedPayload } from '../types';

interface JsonViewerProps {
  payload: GeneratedPayload | null;
  error: string | null;
}

// Premium custom syntax execution for JSON preview
function highlightJson(obj: any): string {
  if (!obj) return '';
  const json = JSON.stringify(obj, null, 2);
  
  // Escape HTML tags to protect against XSS
  const escaped = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Regex matches keys, strings, numbers, booleans, and null values
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'text-amber-500 font-mono'; // Default number/value class
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'text-sky-400 font-medium font-mono'; // Keys
        } else {
          cls = 'text-emerald-400 font-mono'; // String Values
        }
      } else if (/true|false/.test(match)) {
        cls = 'text-indigo-400 font-semibold font-mono';
      } else if (/null/.test(match)) {
        cls = 'text-slate-600 font-mono';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

export default function JsonViewer({ payload, error }: JsonViewerProps) {
  const [activeTab, setActiveTab] = useState<'response' | 'request'>('response');
  const [copied, setCopied] = useState(false);

  // Auto focus tab if payload changes
  useEffect(() => {
    if (payload) {
      if (!payload.response && payload.request) {
        setActiveTab('request');
      }
    }
  }, [payload]);

  const handleCopy = () => {
    const dataToCopy = activeTab === 'response' ? payload?.response : payload?.request;
    if (!dataToCopy) return;

    navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const dataToDownload = activeTab === 'response' ? payload?.response : payload?.request;
    if (!dataToDownload) return;

    const blob = new Blob([JSON.stringify(dataToDownload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `motorcycle_route_${activeTab}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const activeData = activeTab === 'response' ? payload?.response : payload?.request;

  return (
    <div className="w-full h-full bg-[#020617] border border-slate-700/80 rounded-sm flex flex-col overflow-hidden" id="json-viewer-container">
      {/* Tab bar header */}
      <div className="flex justify-between items-center px-4 py-2.5 border-b border-slate-700/80 bg-slate-900 text-xs font-semibold text-slate-400 shrink-0" id="json-viewer-header">
        <div className="flex items-center gap-1.5 sm:gap-4">
          <div className="flex items-center gap-1.5 text-slate-300">
            <FileJson className="w-4 h-4 text-blue-500 animate-pulse" />
            <span className="uppercase tracking-widest text-[9px] hidden sm:inline font-bold font-mono">JSON Engine Payload</span>
          </div>
          
          <div className="flex bg-[#020617] rounded p-0.5 border border-slate-705">
            <button
              id="tab-json-response"
              type="button"
              onClick={() => setActiveTab('response')}
              className={`px-3 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase transition-all outline-none ${
                activeTab === 'response'
                  ? 'bg-slate-800 text-blue-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Response
            </button>
            <button
              id="tab-json-request"
              type="button"
              onClick={() => setActiveTab('request')}
              className={`px-3 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase transition-all outline-none ${
                activeTab === 'request'
                  ? 'bg-slate-800 text-blue-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Request
            </button>
          </div>
        </div>

        {/* Copy/Download Controls */}
        <div className="flex items-center gap-2">
          {activeData && (
            <>
              <button
                id="json-copy-btn"
                type="button"
                onClick={handleCopy}
                className={`btn py-1 px-2.5 text-[11px] font-mono tracking-wider uppercase ${
                  copied
                    ? 'bg-emerald-950/40 border border-emerald-850 text-emerald-400'
                    : 'btn-secondary'
                }`}
                title="Copy current active tab code block to your clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>

              <button
                id="json-download-btn"
                type="button"
                onClick={handleDownload}
                className="btn btn-secondary py-1 px-2.5 text-[11px] font-mono tracking-wider uppercase"
                title="Download JSON Payload file"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Download</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Code window area */}
      <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed max-h-[440px] md:max-h-full" id="json-code-canvas">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-rose-950/10 border border-rose-900/30 rounded-sm select-none">
            <AlertCircle className="w-8 h-8 text-rose-500 mb-2 animate-bounce" />
            <span className="text-slate-300 font-bold mb-1 uppercase tracking-wider font-mono text-[10px]">Routes API Integration Error</span>
            <p className="text-rose-400/80 text-[10px] max-w-sm font-mono leading-relaxed whitespace-pre-line">{error}</p>
          </div>
        ) : activeData ? (
          <pre className="text-[11px] overflow-x-auto whitespace-pre tab-size text-left">
            <code
              id="raw-json-block"
              dangerouslySetInnerHTML={{ __html: highlightJson(activeData) }}
            />
          </pre>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 font-mono text-center select-none py-12">
            <FileJson className="w-8 h-8 text-slate-700 mb-2" />
            <span className="label-tiny tracking-widest uppercase mb-1">Payload Empty</span>
            <p className="max-w-[260px] text-[10px] leading-relaxed text-slate-600">
              Configure origin, destination, and key coordinates, then generate or simulate routing loops to render output payloads.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
