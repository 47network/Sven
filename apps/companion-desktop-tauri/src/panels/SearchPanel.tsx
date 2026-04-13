import { useState, useCallback } from 'react';
import { PanelHeader } from '../components/PanelHeader';

const API = import.meta.env.VITE_API_URL ?? '';

interface SearchResult {
  message_id?: string;
  id?: string;
  chat_id?: string;
  text?: string;
  headline?: string;
  sender_name?: string;
  sent_at?: string;
  chat_name?: string;
  score?: number;
}

type SearchMode = 'unified' | 'messages' | 'semantic';
type ContentType = 'all' | 'text' | 'file' | 'image' | 'audio' | 'video';

export default function SearchPanel() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('unified');
  const [contentType, setContentType] = useState<ContentType>('all');
  const [afterDate, setAfterDate] = useState('');
  const [beforeDate, setBeforeDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const token = localStorage.getItem('auth_token') ?? '';

  const search = useCallback(async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setLoading(true);
    try {
      let url: string;
      let body: Record<string, unknown>;

      if (mode === 'messages') {
        url = `${API}/v1/search/messages`;
        body = { query: q, limit: 50 };
        if (contentType !== 'all') body.content_type = contentType;
        if (afterDate) body.after = new Date(afterDate).toISOString();
        if (beforeDate) body.before = new Date(beforeDate).toISOString();
      } else if (mode === 'semantic') {
        url = `${API}/v1/search/semantic`;
        body = { query: q, limit: 50 };
      } else {
        url = `${API}/v1/search/unified`;
        body = { query: q, types: ['messages', 'files', 'contacts'], limit: 50 };
      }

      const r = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const j = await r.json();
        const d = j.data ?? {};
        if (mode === 'unified') {
          const msgs = d.messages ?? [];
          const files = d.files ?? [];
          const contacts = d.contacts ?? [];
          setResults([...msgs, ...files, ...contacts]);
          setTotal(msgs.length + files.length + contacts.length);
        } else {
          setResults(d.results ?? []);
          setTotal(d.total ?? 0);
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [query, mode, contentType, afterDate, beforeDate, token]);

  return (
    <div className="flex flex-col h-full">
      <PanelHeader title="Advanced Search" />

      {/* Search bar */}
      <div className="px-4 pt-3 pb-2 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Search messages, files..."
          className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:border-cyan-400"
        />
        <button onClick={search} className="px-4 py-2 rounded-lg bg-cyan-500 text-white text-sm hover:bg-cyan-600">
          Search
        </button>
      </div>

      {/* Filter toggle */}
      <div className="px-4 flex items-center gap-3">
        <button onClick={() => setShowFilters(!showFilters)} className="text-xs text-cyan-400 hover:underline flex items-center gap-1">
          {showFilters ? '▾' : '▸'} Filters
        </button>
        {(mode !== 'unified' || contentType !== 'all' || afterDate || beforeDate) && (
          <button
            onClick={() => { setMode('unified'); setContentType('all'); setAfterDate(''); setBeforeDate(''); }}
            className="text-xs text-red-400 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="mx-4 mt-2 p-3 rounded-lg bg-white/3 border border-white/10 space-y-3">
          <div>
            <label className="text-xs opacity-50">Search mode</label>
            <div className="flex gap-2 mt-1">
              {(['unified', 'messages', 'semantic'] as SearchMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1 rounded-full text-xs border transition ${
                    mode === m ? 'bg-cyan-500/15 border-cyan-400 text-cyan-400' : 'border-white/10 opacity-60 hover:opacity-100'
                  }`}
                >
                  {m === 'unified' ? 'Unified' : m === 'messages' ? 'Full-text' : 'Semantic'}
                </button>
              ))}
            </div>
          </div>

          {mode === 'messages' && (
            <>
              <div>
                <label className="text-xs opacity-50">Content type</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {(['all', 'text', 'file', 'image', 'audio', 'video'] as ContentType[]).map((ct) => (
                    <button
                      key={ct}
                      onClick={() => setContentType(ct)}
                      className={`px-3 py-1 rounded-full text-xs border transition ${
                        contentType === ct ? 'bg-cyan-500/15 border-cyan-400 text-cyan-400' : 'border-white/10 opacity-60 hover:opacity-100'
                      }`}
                    >
                      {ct.charAt(0).toUpperCase() + ct.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs opacity-50">After</label>
                  <input
                    type="date"
                    value={afterDate}
                    onChange={(e) => setAfterDate(e.target.value)}
                    className="w-full mt-1 rounded bg-white/5 border border-white/10 px-2 py-1 text-xs outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs opacity-50">Before</label>
                  <input
                    type="date"
                    value={beforeDate}
                    onChange={(e) => setBeforeDate(e.target.value)}
                    className="w-full mt-1 rounded bg-white/5 border border-white/10 px-2 py-1 text-xs outline-none"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && <div className="h-0.5 bg-cyan-400 animate-pulse mx-4 mt-2 rounded" />}

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {!loading && results.length === 0 && query.trim().length >= 2 && (
          <p className="text-center text-sm opacity-40 mt-12">No results for "{query.trim()}"</p>
        )}
        {!loading && results.length === 0 && query.trim().length < 2 && (
          <p className="text-center text-sm opacity-40 mt-12">Type at least 2 characters to search.</p>
        )}
        {total > 0 && (
          <p className="text-xs opacity-40">{total} result{total === 1 ? '' : 's'}</p>
        )}
        {results.map((r, i) => (
          <div key={r.message_id ?? r.id ?? i} className="rounded-lg px-4 py-3 bg-white/3 border border-white/5">
            <div className="flex justify-between items-start">
              <span className="text-sm font-medium">{r.sender_name ?? r.chat_name ?? 'Message'}</span>
              {r.sent_at && (
                <span className="text-xs opacity-40 ml-2 whitespace-nowrap">{new Date(r.sent_at).toLocaleDateString()}</span>
              )}
            </div>
            <p className="text-xs opacity-60 mt-1 line-clamp-3">{r.headline ?? r.text ?? ''}</p>
            {r.score != null && (
              <span className="text-[10px] opacity-30 mt-1 inline-block">score: {r.score.toFixed(3)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
