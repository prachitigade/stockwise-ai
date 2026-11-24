import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CandlestickSeries, ColorType, HistogramSeries, LineSeries, createChart } from 'lightweight-charts';
import { AlertTriangle, ArrowLeft, Bookmark, BookmarkCheck, FileText, HelpCircle, Home, Info, Save, Search, ShieldCheck, Trash2, TrendingUp } from 'lucide-react';
import {
  SAMPLE_INDICES, SAMPLE_RECENT_REPORTS, buildSampleResearchBundle, calculateSMA, searchSampleCompanies,
  type AnalysisMode, type OHLCVBar, type SavedReportSummary, type StockResearchBundle,
} from './finance';

function ScoreBadge({ title, score, suffix = '/100', invertColors = false, simpleMeaning, plainExplanation }: {
  title: string; score: number; suffix?: string; invertColors?: boolean; simpleMeaning: string; plainExplanation: string;
}) {
  const [showHelp, setShowHelp] = useState(false);
  const badgeClass = !invertColors
    ? (score >= 70 ? 'badge-good' : score >= 45 ? 'badge-warn' : 'badge-bad')
    : (score <= 35 ? 'badge-good' : score <= 60 ? 'badge-warn' : 'badge-bad');
  return (
    <div className="score-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>{title}</span>
        <button type="button" onClick={() => setShowHelp((v) => !v)} aria-label={`Explain ${title}`} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2 }}>
          <HelpCircle size={16} color="#64748b" />
        </button>
      </div>
      <div style={{ marginTop: 6, fontSize: '1.35rem', fontWeight: 800 }}>
        {score}<span style={{ fontSize: '0.78rem', fontWeight: 500, color: '#64748b' }}>{suffix}</span>
      </div>
      <div style={{ marginTop: 4 }}><span className={`badge ${badgeClass}`}>{simpleMeaning}</span></div>
      {showHelp && <div className="helper-box">{plainExplanation}</div>}
    </div>
  );
}

function StockChart({ bars }: { bars: OHLCVBar[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [range, setRange] = useState<'1M' | '3M' | '6M'>('3M');
  const [showSma, setShowSma] = useState(true);

  const visibleBars = useMemo(() => bars.slice(-(range === '1M' ? 22 : range === '3M' ? 66 : bars.length)), [bars, range]);
  const sma20Data = useMemo(() => {
    const sma20 = calculateSMA(bars.map((b) => b.close), 20);
    const offset = bars.length - visibleBars.length;
    return visibleBars.map((b, i) => {
      const val = sma20[offset + i];
      return val != null ? { time: b.time, value: val } : null;
    }).filter((x): x is { time: string; value: number } => x !== null);
  }, [bars, visibleBars]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || visibleBars.length === 0) return;
    const chart = createChart(el, {
      layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#334155' },
      grid: { vertLines: { color: '#f1f5f9' }, horzLines: { color: '#f1f5f9' } },
      width: el.clientWidth, height: 260,
    });
    const candles = chart.addSeries(CandlestickSeries, { upColor: '#059669', downColor: '#dc2626', borderVisible: false, wickUpColor: '#059669', wickDownColor: '#dc2626' });
    candles.setData(visibleBars.map((b) => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close })));
    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: '' });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    vol.setData(visibleBars.map((b) => ({ time: b.time, value: b.volume, color: b.close >= b.open ? 'rgba(5,150,105,0.25)' : 'rgba(220,38,38,0.25)' })));
    if (showSma && sma20Data.length > 0) {
      chart.addSeries(LineSeries, { color: '#1d4ed8', lineWidth: 2, title: '20D Avg' }).setData(sma20Data);
    }
    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => { if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth }); });
    ro.observe(el);
    return () => { ro.disconnect(); chart.remove(); };
  }, [visibleBars, showSma, sma20Data]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="chip-row">
          {(['1M', '3M', '6M'] as const).map((k) => (
            <button key={k} type="button" className={`chip ${range === k ? 'active' : ''}`} onClick={() => setRange(k)}>{k}</button>
          ))}
        </div>
        <button type="button" className={`chip ${showSma ? 'active' : ''}`} onClick={() => setShowSma((s) => !s)}>20D Avg Line</button>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: 260 }} />
      <div style={{ marginTop: 6, fontSize: '0.72rem', color: '#64748b', textAlign: 'right' }}>
        Charts by <a href="https://www.tradingview.com" target="_blank" rel="noreferrer" style={{ color: '#0f766e' }}>TradingView Lightweight Charts™</a>
      </div>
    </div>
  );
}

function App() {
  const [tab, setTab] = useState<'home' | 'watchlist' | 'reports' | 'guide'>('home');
  const [mode, setMode] = useState<AnalysisMode>('investment');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try { const r = localStorage.getItem('sw_watch_v1'); return r ? JSON.parse(r) : ['TCS', 'HDFCBANK']; } catch { return ['TCS', 'HDFCBANK']; }
  });
  const [reports, setReports] = useState<SavedReportSummary[]>(() => {
    try { const r = localStorage.getItem('sw_rep_v1'); return r ? JSON.parse(r) : SAMPLE_RECENT_REPORTS; } catch { return SAMPLE_RECENT_REPORTS; }
  });

  useEffect(() => { localStorage.setItem('sw_watch_v1', JSON.stringify(watchlist)); }, [watchlist]);
  useEffect(() => { localStorage.setItem('sw_rep_v1', JSON.stringify(reports)); }, [reports]);

  const activeBundle = useMemo(() => (selectedSymbol ? buildSampleResearchBundle(selectedSymbol, mode) : null), [selectedSymbol, mode]);
  const searchResults = useMemo(() => searchSampleCompanies(query), [query]);
  const toggleWatchlist = (sym: string) => setWatchlist((p) => (p.includes(sym) ? p.filter((s) => s !== sym) : [sym, ...p]));
  const saveReport = (b: StockResearchBundle) => {
    setReports((p) => [{
      id: `rep-${Date.now()}`, nseSymbol: b.company.nseSymbol, companyName: b.company.name, mode: b.aiConclusion.mode,
      priceAtReport: b.quote.priceInr, fundamentalScore: b.scores.fundamentalScore, technicalScore: b.scores.technicalScore,
      riskScore: b.scores.riskScore, confidenceScore: b.confidence.score, createdAt: new Date().toISOString(), isSampleData: b.quote.isSampleData,
    }, ...p]);
    alert(`Saved ${b.company.nseSymbol} report!`);
  };

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <div className="brand-title">StockWise AI</div>
          <div className="brand-subtitle">Simple NSE/BSE Research</div>
        </div>
        <span className="badge badge-warn">Phase 1: Sample Data</span>
      </header>
      <div className="sample-banner">
        <AlertTriangle size={18} style={{ flexShrink: 0 }} />
        <span>Sample research data only — not live NSE/BSE prices or financial advice.</span>
      </div>

      {activeBundle ? (
        <div className="page-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <button type="button" className="btn btn-outline" onClick={() => setSelectedSymbol(null)}><ArrowLeft size={18} /> Back</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-outline" onClick={() => toggleWatchlist(activeBundle.company.nseSymbol)}>
                {watchlist.includes(activeBundle.company.nseSymbol) ? <BookmarkCheck size={18} color="#059669" /> : <Bookmark size={18} />}
                {watchlist.includes(activeBundle.company.nseSymbol) ? 'Saved' : 'Watchlist'}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => saveReport(activeBundle)}><Save size={18} /> Save</button>
            </div>
          </div>

          <div className="card">
            <span className="badge badge-neutral">NSE: {activeBundle.company.nseSymbol} • BSE: {activeBundle.company.bseCode}</span>
            <h1 style={{ margin: '8px 0 4px', fontSize: '1.25rem' }}>{activeBundle.company.name}</h1>
            <div style={{ fontSize: '0.82rem', color: '#475569' }}>{activeBundle.company.sector} • ISIN: {activeBundle.company.isin}</div>
            <p style={{ margin: '10px 0', fontSize: '0.92rem' }}>{activeBundle.company.plainDescription}</p>
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.7rem', fontWeight: 800 }}>₹{activeBundle.quote.priceInr.toLocaleString('en-IN')}</span>
                <span className={activeBundle.quote.changeInr >= 0 ? 'positive' : 'negative'}>
                  {activeBundle.quote.changeInr >= 0 ? '+' : ''}{activeBundle.quote.changeInr} ({activeBundle.quote.changePct}%)
                </span>
                <span className="badge badge-warn">Sample Price</span>
              </div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 4 }}>
                Time: {new Date(activeBundle.quote.asOfTimestamp).toLocaleString('en-IN')} • {activeBundle.quote.sourceName}
              </div>
            </div>
          </div>

          <div className="chip-row">
            <button type="button" className={`chip ${mode === 'investment' ? 'active' : ''}`} onClick={() => setMode('investment')}>Investment View</button>
            <button type="button" className={`chip ${mode === 'trading' ? 'active' : ''}`} onClick={() => setMode('trading')}>Trading View</button>
          </div>

          <div className="grid-2">
            <ScoreBadge title="Fundamental Score" score={activeBundle.scores.fundamentalScore} simpleMeaning={activeBundle.scores.fundamentalScore >= 70 ? 'Strong Business' : 'Average'} plainExplanation="Measures profits, debt safety, and valuation using fixed math." />
            <ScoreBadge title="Technical Score" score={activeBundle.scores.technicalScore} simpleMeaning={activeBundle.technicals.trendLabel} plainExplanation="Checks price trend using moving averages, RSI, and MACD." />
            <ScoreBadge title="Risk Score" score={activeBundle.scores.riskScore} invertColors simpleMeaning={activeBundle.scores.riskScore <= 35 ? 'Lower Risk' : activeBundle.scores.riskScore <= 60 ? 'Moderate' : 'High Risk'} plainExplanation="Higher score means larger price ups-and-downs or high debt." />
            <ScoreBadge title="Data Confidence" score={activeBundle.confidence.score} suffix="%" simpleMeaning={activeBundle.confidence.level} plainExplanation={activeBundle.confidence.reasons.join(' ')} />
          </div>

          <div className="card"><h2 className="card-title">Price Chart</h2><StockChart bars={activeBundle.bars} /></div>

          <div className="card">
            <h2 className="card-title"><span>Key Financial Facts</span><span className="badge badge-neutral">{activeBundle.fundamentals.fiscalPeriod}</span></h2>
            <div className="grid-2" style={{ fontSize: '0.88rem' }}>
              <div><strong>Market Cap:</strong> ₹{activeBundle.fundamentals.marketCapCr.toLocaleString('en-IN')} Cr</div>
              <div><strong>P/E:</strong> {activeBundle.fundamentals.peRatio ?? 'N/A'} (Sector: {activeBundle.fundamentals.sectorPeRatio ?? 'N/A'})</div>
              <div><strong>ROE:</strong> {activeBundle.fundamentals.roePct !== null ? `${activeBundle.fundamentals.roePct}%` : 'N/A'}</div>
              <div><strong>Debt/Equity:</strong> {activeBundle.fundamentals.debtToEquity ?? 'N/A'}</div>
              <div><strong>RSI (14D):</strong> {activeBundle.technicals.rsi14 ?? 'N/A'}</div>
              <div><strong>Volatility:</strong> {activeBundle.technicals.annualizedVolatilityPct !== null ? `${activeBundle.technicals.annualizedVolatilityPct}%` : 'N/A'}</div>
            </div>
          </div>

          <div className="card">
            <h2 className="card-title">Research Conclusions</h2>
            <div className="fact-box" style={{ marginBottom: 10 }}>
              <strong style={{ fontSize: '0.88rem' }}>1. Verified Math Findings</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.88rem' }}>
                {[...activeBundle.scores.fundamentalReasons, ...activeBundle.scores.technicalReasons].map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
            <div className="ai-box">
              <strong style={{ fontSize: '0.88rem' }}>2. Simple-Language Summary</strong>
              <p style={{ margin: '6px 0', fontSize: '0.92rem' }}>{activeBundle.aiConclusion.plainLanguageSummary}</p>
              <div style={{ fontSize: '0.75rem', color: '#0f766e', fontWeight: 600 }}>{activeBundle.aiConclusion.disclaimer}</div>
            </div>
          </div>

          <div className="card">
            <h2 className="card-title">Competitor Comparison</h2>
            <div className="table-scroll">
              <table className="simple-table">
                <thead><tr><th>Stock</th><th>M.Cap (Cr)</th><th>P/E</th><th>ROE %</th></tr></thead>
                <tbody>
                  {activeBundle.competitors.map((c) => (
                    <tr key={c.nseSymbol}><td><strong>{c.nseSymbol}</strong></td><td>₹{c.marketCapCr.toLocaleString('en-IN')}</td><td>{c.peRatio ?? 'N/A'}</td><td>{c.roePct ?? 'N/A'}%</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2 className="card-title">Company Announcements</h2>
            {activeBundle.announcements.map((a) => (
              <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{a.exchange} • {a.category} • {new Date(a.publishedAt).toLocaleDateString('en-IN')}</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{a.title}</div>
                <div style={{ fontSize: '0.84rem', color: '#475569' }}>{a.plainSummary}</div>
              </div>
            ))}
          </div>
        </div>
      ) : tab === 'home' ? (
        <div className="page-content">
          <div className="card">
            <div className="search-box">
              <Search size={20} color="#64748b" />
              <input className="search-input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search stock (TCS, RELIANCE, 532540, ITC)" />
            </div>
            <div style={{ marginTop: 10 }}>
              {searchResults.slice(0, query ? 5 : 3).map((c) => {
                const b = buildSampleResearchBundle(c.nseSymbol, mode)!;
                return (
                  <div key={c.isin} className="stock-row" onClick={() => setSelectedSymbol(c.nseSymbol)}>
                    <div><div style={{ fontWeight: 700 }}>{c.nseSymbol}</div><div style={{ fontSize: '0.8rem', color: '#475569' }}>{c.name}</div></div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700 }}>₹{b.quote.priceInr.toLocaleString('en-IN')}</div>
                      <div className={b.quote.changePct >= 0 ? 'positive' : 'negative'} style={{ fontSize: '0.78rem' }}>{b.quote.changePct >= 0 ? '+' : ''}{b.quote.changePct}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid-2">
            <button type="button" className={`mode-btn ${mode === 'investment' ? 'active' : ''}`} onClick={() => setMode('investment')}>
              <ShieldCheck size={20} color="#0f766e" /><span className="mode-label">Investment Analysis</span><span className="mode-desc">Long-term business & debt</span>
            </button>
            <button type="button" className={`mode-btn ${mode === 'trading' ? 'active' : ''}`} onClick={() => setMode('trading')}>
              <TrendingUp size={20} color="#1d4ed8" /><span className="mode-label">Trading Analysis</span><span className="mode-desc">Price trend & RSI momentum</span>
            </button>
          </div>

          <section>
            <div className="card-title"><span>Market Overview</span><span className="badge badge-warn">Sample</span></div>
            <div className="horiz-scroll">
              {SAMPLE_INDICES.map((idx) => (
                <div key={idx.symbol} className="index-pill">
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>{idx.name}</div>
                  <div style={{ fontSize: '1.08rem', fontWeight: 800, marginTop: 4 }}>{idx.value.toLocaleString('en-IN')}</div>
                  <div className={idx.changePct >= 0 ? 'positive' : 'negative'} style={{ fontSize: '0.8rem' }}>{idx.changePct >= 0 ? '+' : ''}{idx.changePct}%</div>
                </div>
              ))}
            </div>
          </section>

          <div className="card">
            <h2 className="card-title">Watchlist ({watchlist.length})</h2>
            {watchlist.map((sym) => {
              const b = buildSampleResearchBundle(sym, mode);
              if (!b) return null;
              return (
                <div key={sym} className="stock-row" onClick={() => setSelectedSymbol(sym)}>
                  <div><div style={{ fontWeight: 700 }}>{sym}</div><div style={{ fontSize: '0.78rem', color: '#64748b' }}>Health: {b.scores.fundamentalScore}/100</div></div>
                  <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 700 }}>₹{b.quote.priceInr.toLocaleString('en-IN')}</div><span className="badge badge-neutral">{b.technicals.trendLabel}</span></div>
                </div>
              );
            })}
          </div>

          <div className="card">
            <h2 className="card-title">Recent Reports</h2>
            {reports.slice(0, 3).map((r) => (
              <div key={r.id} className="stock-row" onClick={() => { setMode(r.mode); setSelectedSymbol(r.nseSymbol); }}>
                <div><div style={{ fontWeight: 700 }}>{r.nseSymbol} • {r.mode}</div><div style={{ fontSize: '0.78rem', color: '#64748b' }}>{new Date(r.createdAt).toLocaleDateString('en-IN')}</div></div>
                <span className="badge badge-good">Fund {r.fundamentalScore}</span>
              </div>
            ))}
          </div>
        </div>
      ) : tab === 'watchlist' ? (
        <div className="page-content"><div className="card"><h1 className="card-title">Saved Watchlist</h1>
          {watchlist.map((sym) => (
            <div key={sym} className="stock-row">
              <div style={{ flex: 1, fontWeight: 700 }} onClick={() => setSelectedSymbol(sym)}>{sym}</div>
              <button type="button" className="btn btn-outline" style={{ minHeight: 40, padding: 8 }} onClick={() => toggleWatchlist(sym)}><Trash2 size={16} color="#dc2626" /></button>
            </div>
          ))}
        </div></div>
      ) : tab === 'reports' ? (
        <div className="page-content"><div className="card"><h1 className="card-title">Saved Reports</h1>
          {reports.map((r) => (
            <div key={r.id} className="stock-row" onClick={() => setSelectedSymbol(r.nseSymbol)}>
              <div><div style={{ fontWeight: 700 }}>{r.nseSymbol} ({r.mode})</div><div style={{ fontSize: '0.78rem', color: '#64748b' }}>₹{r.priceAtReport}</div></div>
              <span className="badge badge-good">Fund {r.fundamentalScore}</span>
            </div>
          ))}
        </div></div>
      ) : (
        <div className="page-content"><div className="card"><h1 className="card-title">Easy Guide</h1>
          <p><strong>Fundamental Score:</strong> How strong and profitable the company is.</p>
          <p><strong>Technical Score:</strong> Whether the recent price trend is moving up or down.</p>
          <p><strong>Risk Score:</strong> Lower number means calmer price movement and lower debt.</p>
          <p><strong>Data Confidence:</strong> Tells you whether prices are sample placeholders or live verified filings.</p>
          <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Charts powered by <a href="https://www.tradingview.com" target="_blank" rel="noreferrer">TradingView Lightweight Charts™</a>.</p>
        </div></div>
      )}

      <nav className="bottom-nav">
        <button type="button" className={`nav-item ${tab === 'home' && !selectedSymbol ? 'active' : ''}`} onClick={() => { setSelectedSymbol(null); setTab('home'); }}><Home size={20} />Home</button>
        <button type="button" className={`nav-item ${tab === 'watchlist' && !selectedSymbol ? 'active' : ''}`} onClick={() => { setSelectedSymbol(null); setTab('watchlist'); }}><Bookmark size={20} />Watchlist</button>
        <button type="button" className={`nav-item ${tab === 'reports' && !selectedSymbol ? 'active' : ''}`} onClick={() => { setSelectedSymbol(null); setTab('reports'); }}><FileText size={20} />Reports</button>
        <button type="button" className={`nav-item ${tab === 'guide' && !selectedSymbol ? 'active' : ''}`} onClick={() => { setSelectedSymbol(null); setTab('guide'); }}><Info size={20} />Guide</button>
      </nav>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
