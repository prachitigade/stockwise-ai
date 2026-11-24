export type ExchangeCode = 'NSE' | 'BSE';
export type AnalysisMode = 'investment' | 'trading';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface CompanyProfile {
  isin: string; nseSymbol: string; bseCode: string; name: string;
  sector: string; industry: string; plainDescription: string;
}

export interface PriceSnapshot {
  exchange: ExchangeCode; priceInr: number; changeInr: number; changePct: number;
  openInr: number; highInr: number; lowInr: number; prevCloseInr: number; volume: number;
  asOfTimestamp: string; sourceName: string; isSampleData: boolean; isStale: boolean;
}

export interface OHLCVBar {
  time: string; open: number; high: number; low: number; close: number; volume: number;
}

export interface FundamentalMetrics {
  fiscalPeriod: string; marketCapCr: number; peRatio: number | null; sectorPeRatio: number | null;
  pbRatio: number | null; roePct: number | null; rocePct: number | null; debtToEquity: number | null;
  revenueGrowth3YrPct: number | null; profitGrowth3YrPct: number | null; operatingMarginPct: number | null;
  dividendYieldPct: number | null; freeCashFlowCr: number | null;
  sourceName: string; sourceUrl: string; isSampleData: boolean;
}

export interface TechnicalIndicatorSummary {
  latestClose: number; sma20: number | null; sma50: number | null; sma200: number | null;
  ema12: number | null; ema26: number | null; rsi14: number | null;
  macd: number | null; macdSignal: number | null; macdHistogram: number | null;
  annualizedVolatilityPct: number | null; maxDrawdownPct: number | null;
  trendLabel: 'Uptrend' | 'Sideways' | 'Downtrend' | 'Insufficient Data';
}

export interface CompetitorRow {
  nseSymbol: string; name: string; marketCapCr: number;
  peRatio: number | null; roePct: number | null; debtToEquity: number | null;
}

export interface AnnouncementItem {
  id: string; exchange: ExchangeCode; category: string; title: string;
  plainSummary: string; publishedAt: string; sourceName: string; sourceUrl: string; isSampleData: boolean;
}

export interface DataConfidenceReport {
  score: number; level: ConfidenceLevel; reasons: string[]; missingFields: string[]; isSampleData: boolean;
}

export interface DeterministicScores {
  fundamentalScore: number; technicalScore: number; riskScore: number;
  fundamentalReasons: string[]; technicalReasons: string[]; riskReasons: string[];
}

export interface AIResearchConclusion {
  mode: AnalysisMode; plainLanguageSummary: string; keyStrengths: string[];
  keyRisks: string[]; whatToWatchNext: string[];
  generatedByProvider: string; generatedByModel: string; isFallbackRuleBased: boolean; disclaimer: string;
}

export interface StockResearchBundle {
  company: CompanyProfile; quote: PriceSnapshot; bars: OHLCVBar[];
  fundamentals: FundamentalMetrics; technicals: TechnicalIndicatorSummary;
  scores: DeterministicScores; confidence: DataConfidenceReport;
  competitors: CompetitorRow[]; announcements: AnnouncementItem[]; aiConclusion: AIResearchConclusion;
}

export interface MarketIndexSnapshot {
  name: string; symbol: string; value: number; change: number; changePct: number;
  asOfTimestamp: string; sourceName: string; isSampleData: boolean;
}

export interface SavedReportSummary {
  id: string; nseSymbol: string; companyName: string; mode: AnalysisMode;
  priceAtReport: number; fundamentalScore: number; technicalScore: number;
  riskScore: number; confidenceScore: number; createdAt: string; isSampleData: boolean;
}

export function calculateSMA(values: readonly number[], period: number): Array<number | null> {
  const result: Array<number | null> = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return result;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    if (i >= period - 1) result[i] = Number((sum / period).toFixed(2));
  }
  return result;
}

export function calculateEMA(values: readonly number[], period: number): Array<number | null> {
  const result: Array<number | null> = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return result;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i]!;
  let ema = seed / period;
  result[period - 1] = Number(ema.toFixed(2));
  for (let i = period; i < values.length; i++) {
    ema = values[i]! * k + ema * (1 - k);
    result[i] = Number(ema.toFixed(2));
  }
  return result;
}

export function calculateRSI(closes: readonly number[], period = 14): Array<number | null> {
  const result: Array<number | null> = new Array(closes.length).fill(null);
  if (closes.length <= period) return result;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i]! - closes[i - 1]!;
    if (d >= 0) gains += d; else losses += Math.abs(d);
  }
  let avgGain = gains / period, avgLoss = losses / period;
  const toRsi = (g: number, l: number) => l === 0 ? (g === 0 ? 50 : 100) : Number((100 - 100 / (1 + g / l)).toFixed(2));
  result[period] = toRsi(avgGain, avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i]! - closes[i - 1]!;
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? Math.abs(d) : 0)) / period;
    result[i] = toRsi(avgGain, avgLoss);
  }
  return result;
}

export function calculateMACD(closes: readonly number[]) {
  const fast = calculateEMA(closes, 12);
  const slow = calculateEMA(closes, 26);
  const macdLine = closes.map((_, i) => (fast[i] != null && slow[i] != null ? Number((fast[i]! - slow[i]!).toFixed(2)) : null));
  const start = macdLine.findIndex((v) => v !== null);
  const signalLine: Array<number | null> = new Array(closes.length).fill(null);
  const histogram: Array<number | null> = new Array(closes.length).fill(null);
  if (start !== -1) {
    const sig = calculateEMA(macdLine.slice(start) as number[], 9);
    for (let i = 0; i < sig.length; i++) {
      const idx = start + i;
      signalLine[idx] = sig[i] ?? null;
      if (sig[i] != null && macdLine[idx] != null) histogram[idx] = Number((macdLine[idx]! - sig[i]!).toFixed(2));
    }
  }
  return { macdLine, signalLine, histogram };
}

export function calculateAnnualizedVolatility(closes: readonly number[]): number | null {
  if (closes.length < 15) return null;
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1]! > 0 && closes[i]! > 0) rets.push(Math.log(closes[i]! / closes[i - 1]!));
  }
  if (rets.length < 10) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1);
  return Number((Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(2));
}

export function calculateMaxDrawdown(closes: readonly number[]): number | null {
  if (closes.length < 2) return null;
  let peak = closes[0]!, maxDd = 0;
  for (const p of closes) {
    if (p > peak) peak = p;
    if (peak > 0) maxDd = Math.max(maxDd, ((peak - p) / peak) * 100);
  }
  return Number(maxDd.toFixed(2));
}

export function computeTechnicalSummary(bars: readonly OHLCVBar[]): TechnicalIndicatorSummary {
  const closes = bars.map((b) => b.close);
  const last = closes.length - 1;
  const latestClose = last >= 0 ? closes[last]! : 0;
  const sma20 = last >= 0 ? (calculateSMA(closes, 20)[last] ?? null) : null;
  const sma50 = last >= 0 ? (calculateSMA(closes, 50)[last] ?? null) : null;
  const sma200 = last >= 0 ? (calculateSMA(closes, 200)[last] ?? null) : null;
  const macd = calculateMACD(closes);
  let trendLabel: TechnicalIndicatorSummary['trendLabel'] = 'Insufficient Data';
  if (sma20 !== null && sma50 !== null) {
    if (latestClose > sma20 && sma20 > sma50) trendLabel = 'Uptrend';
    else if (latestClose < sma20 && sma20 < sma50) trendLabel = 'Downtrend';
    else trendLabel = 'Sideways';
  }
  return {
    latestClose, sma20, sma50, sma200,
    ema12: last >= 0 ? (calculateEMA(closes, 12)[last] ?? null) : null,
    ema26: last >= 0 ? (calculateEMA(closes, 26)[last] ?? null) : null,
    rsi14: last >= 0 ? (calculateRSI(closes, 14)[last] ?? null) : null,
    macd: last >= 0 ? (macd.macdLine[last] ?? null) : null,
    macdSignal: last >= 0 ? (macd.signalLine[last] ?? null) : null,
    macdHistogram: last >= 0 ? (macd.histogram[last] ?? null) : null,
    annualizedVolatilityPct: calculateAnnualizedVolatility(closes),
    maxDrawdownPct: calculateMaxDrawdown(closes),
    trendLabel,
  };
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

export function calculateDeterministicScores(f: FundamentalMetrics, t: TechnicalIndicatorSummary): DeterministicScores {
  let fScore = 50; const fundamentalReasons: string[] = [];
  if (f.roePct !== null) {
    if (f.roePct >= 18) { fScore += 16; fundamentalReasons.push(`Strong Return on Equity (${f.roePct}% >= 18%).`); }
    else if (f.roePct >= 12) { fScore += 8; fundamentalReasons.push(`Healthy Return on Equity (${f.roePct}%).`); }
    else { fScore -= 8; fundamentalReasons.push(`Modest Return on Equity (${f.roePct}% < 12%).`); }
  }
  if (f.debtToEquity !== null) {
    if (f.debtToEquity <= 0.3) { fScore += 14; fundamentalReasons.push(`Very low debt burden (Debt/Equity ${f.debtToEquity}).`); }
    else if (f.debtToEquity <= 1) { fScore += 5; fundamentalReasons.push(`Manageable debt (Debt/Equity ${f.debtToEquity}).`); }
    else { fScore -= 14; fundamentalReasons.push(`High debt leverage (Debt/Equity ${f.debtToEquity}).`); }
  }
  if (f.peRatio !== null && f.sectorPeRatio !== null) {
    if (f.peRatio < f.sectorPeRatio * 0.9) { fScore += 10; fundamentalReasons.push(`Cheaper than sector P/E (${f.peRatio} vs ${f.sectorPeRatio}).`); }
    else if (f.peRatio > f.sectorPeRatio * 1.25) { fScore -= 8; fundamentalReasons.push(`Expensive vs sector P/E (${f.peRatio} vs ${f.sectorPeRatio}).`); }
  }
  if (f.profitGrowth3YrPct !== null && f.profitGrowth3YrPct >= 12) {
    fScore += 10; fundamentalReasons.push(`Steady 3-year profit growth (${f.profitGrowth3YrPct}%).`);
  }

  let tScore = 50; const technicalReasons: string[] = [];
  if (t.trendLabel === 'Uptrend') { tScore += 18; technicalReasons.push('Price is above 20-day & 50-day averages (Uptrend).'); }
  else if (t.trendLabel === 'Downtrend') { tScore -= 18; technicalReasons.push('Price is below 20-day & 50-day averages (Downtrend).'); }
  else technicalReasons.push('Moving averages show sideways movement.');

  if (t.rsi14 !== null) {
    if (t.rsi14 >= 50 && t.rsi14 <= 68) { tScore += 12; technicalReasons.push(`Healthy momentum (RSI-14 at ${t.rsi14}).`); }
    else if (t.rsi14 > 70) { tScore -= 5; technicalReasons.push(`Overbought warning (RSI-14 at ${t.rsi14} > 70).`); }
    else if (t.rsi14 < 30) { tScore -= 8; technicalReasons.push(`Oversold zone (RSI-14 at ${t.rsi14} < 30).`); }
  }
  if (t.macdHistogram !== null) {
    if (t.macdHistogram > 0) { tScore += 10; technicalReasons.push('MACD histogram is positive.'); }
    else { tScore -= 10; technicalReasons.push('MACD histogram is negative.'); }
  }

  let rScore = 30; const riskReasons: string[] = [];
  if (t.annualizedVolatilityPct !== null) {
    if (t.annualizedVolatilityPct > 35) { rScore += 28; riskReasons.push(`High price swings (${t.annualizedVolatilityPct}% volatility).`); }
    else if (t.annualizedVolatilityPct > 22) { rScore += 14; riskReasons.push(`Moderate price swings (${t.annualizedVolatilityPct}% volatility).`); }
    else riskReasons.push(`Steady price movement (${t.annualizedVolatilityPct}% volatility).`);
  }
  if (t.maxDrawdownPct !== null && t.maxDrawdownPct > 20) { rScore += 15; riskReasons.push(`Dropped ${t.maxDrawdownPct}% from recent peak.`); }
  if (f.debtToEquity !== null && f.debtToEquity > 1) { rScore += 15; riskReasons.push(`High debt ratio (${f.debtToEquity}).`); }

  return { fundamentalScore: clamp(fScore), technicalScore: clamp(tScore), riskScore: clamp(rScore), fundamentalReasons, technicalReasons, riskReasons };
}

export function calculateDataConfidence(q: PriceSnapshot, f: FundamentalMetrics, barCount: number): DataConfidenceReport {
  let score = 100; const reasons: string[] = []; const missingFields: string[] = [];
  if (q.isSampleData) { score -= 40; reasons.push('Phase 1 sample dataset (not live NSE/BSE prices).'); }
  if (q.isStale) { score -= 20; reasons.push('Timestamp is from sample snapshot, not live market.'); }
  if (barCount < 200) { score -= 10; reasons.push(`Only ${barCount} daily bars (200-day avg unavailable).`); }
  if (f.peRatio === null) { missingFields.push('P/E'); score -= 5; }
  if (f.roePct === null) { missingFields.push('ROE'); score -= 5; }
  if (f.debtToEquity === null) { missingFields.push('Debt/Equity'); score -= 5; }
  const s = clamp(score);
  return { score: s, level: s >= 75 ? 'HIGH' : s >= 50 ? 'MEDIUM' : 'LOW', reasons, missingFields, isSampleData: q.isSampleData };
}

function generateSampleBars(startPrice: number, seed: number, days = 180): OHLCVBar[] {
  let s = seed;
  const rand = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  const bars: OHLCVBar[] = []; let price = startPrice;
  const baseDate = new Date('2026-05-01T00:00:00Z');
  let added = 0, offset = 0;
  while (added < days) {
    const d = new Date(baseDate.getTime() + offset * 86400000); offset++;
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    const open = Number(price.toFixed(2));
    const close = Number(Math.max(10, open * (1 + (rand() - 0.485) * 0.024)).toFixed(2));
    bars.push({
      time: d.toISOString().slice(0, 10), open, close,
      high: Number((Math.max(open, close) * (1 + rand() * 0.012)).toFixed(2)),
      low: Number((Math.min(open, close) * (1 - rand() * 0.012)).toFixed(2)),
      volume: Math.round(650000 + rand() * 1900000),
    });
    price = close; added++;
  }
  return bars;
}

const SAMPLE_SEEDS = [
  {
    company: { isin: 'INE467B01029', nseSymbol: 'TCS', bseCode: '532540', name: 'Tata Consultancy Services Ltd.', sector: 'Information Technology', industry: 'IT Services', plainDescription: 'India’s largest IT services company building software and cloud systems for global businesses.' },
    startPrice: 3780, seed: 101,
    fundamentals: { fiscalPeriod: 'Sample Baseline (Non-Live)', marketCapCr: 1410000, peRatio: 28.4, sectorPeRatio: 29.8, pbRatio: 13.5, roePct: 48.2, rocePct: 58.1, debtToEquity: 0.08, revenueGrowth3YrPct: 10.4, profitGrowth3YrPct: 9.8, operatingMarginPct: 24.6, dividendYieldPct: 1.5, freeCashFlowCr: 43200, sourceName: 'Phase 1 Sample Fixture', sourceUrl: 'https://www.bseindia.com/', isSampleData: true },
    competitors: [
      { nseSymbol: 'INFY', name: 'Infosys Ltd.', marketCapCr: 740000, peRatio: 26.5, roePct: 31.2, debtToEquity: 0.1 },
      { nseSymbol: 'HCLTECH', name: 'HCL Tech', marketCapCr: 460000, peRatio: 25.1, roePct: 24.4, debtToEquity: 0.09 },
    ],
    announcements: [{ id: '1', exchange: 'NSE' as const, category: 'Dividend', title: 'Sample Filing: Quarterly Results & Dividend Review', plainSummary: 'Sample placeholder showing how official exchange announcements appear.', publishedAt: '2026-10-15T10:30:00+05:30', sourceName: 'Sample Placeholder', sourceUrl: 'https://www.nseindia.com/', isSampleData: true }],
  },
  {
    company: { isin: 'INE002A01018', nseSymbol: 'RELIANCE', bseCode: '500325', name: 'Reliance Industries Ltd.', sector: 'Conglomerate', industry: 'Energy, Jio & Retail', plainDescription: 'Operates Jio telecom, Reliance Retail stores across India, and large energy refineries.' },
    startPrice: 1260, seed: 202,
    fundamentals: { fiscalPeriod: 'Sample Baseline (Non-Live)', marketCapCr: 1750000, peRatio: 25.2, sectorPeRatio: 21.0, pbRatio: 2.2, roePct: 9.8, rocePct: 10.6, debtToEquity: 0.42, revenueGrowth3YrPct: 11.8, profitGrowth3YrPct: 12.5, operatingMarginPct: 17.8, dividendYieldPct: 0.4, freeCashFlowCr: 28500, sourceName: 'Phase 1 Sample Fixture', sourceUrl: 'https://www.bseindia.com/', isSampleData: true },
    competitors: [
      { nseSymbol: 'BHARTIARTL', name: 'Bharti Airtel', marketCapCr: 920000, peRatio: 44.0, roePct: 16.5, debtToEquity: 1.4 },
      { nseSymbol: 'ONGC', name: 'ONGC Ltd.', marketCapCr: 340000, peRatio: 7.8, roePct: 14.2, debtToEquity: 0.45 },
    ],
    announcements: [{ id: '2', exchange: 'BSE' as const, category: 'Earnings', title: 'Sample Filing: Consolidated Financial Results', plainSummary: 'Sample placeholder representing BSE XBRL earnings filing.', publishedAt: '2026-10-18T17:15:00+05:30', sourceName: 'Sample Placeholder', sourceUrl: 'https://www.bseindia.com/', isSampleData: true }],
  },
  {
    company: { isin: 'INE040A01034', nseSymbol: 'HDFCBANK', bseCode: '500180', name: 'HDFC Bank Ltd.', sector: 'Banking', industry: 'Private Bank', plainDescription: 'India’s largest private bank offering savings accounts, home loans, and business banking.' },
    startPrice: 1640, seed: 303,
    fundamentals: { fiscalPeriod: 'Sample Baseline (Non-Live)', marketCapCr: 1290000, peRatio: 18.6, sectorPeRatio: 17.2, pbRatio: 2.7, roePct: 16.4, rocePct: null, debtToEquity: null, revenueGrowth3YrPct: 16.2, profitGrowth3YrPct: 17.1, operatingMarginPct: null, dividendYieldPct: 1.1, freeCashFlowCr: null, sourceName: 'Phase 1 Sample Fixture', sourceUrl: 'https://www.bseindia.com/', isSampleData: true },
    competitors: [
      { nseSymbol: 'ICICIBANK', name: 'ICICI Bank', marketCapCr: 880000, peRatio: 19.2, roePct: 17.9, debtToEquity: null },
      { nseSymbol: 'SBIN', name: 'SBI', marketCapCr: 720000, peRatio: 10.8, roePct: 18.1, debtToEquity: null },
    ],
    announcements: [{ id: '3', exchange: 'NSE' as const, category: 'Governance', title: 'Sample Filing: Deposit & Loan Growth Update', plainSummary: 'Sample placeholder showing quarterly banking update.', publishedAt: '2026-10-05T09:05:00+05:30', sourceName: 'Sample Placeholder', sourceUrl: 'https://www.nseindia.com/', isSampleData: true }],
  },
  {
    company: { isin: 'INE009A01021', nseSymbol: 'INFY', bseCode: '500209', name: 'Infosys Ltd.', sector: 'Information Technology', industry: 'IT Services', plainDescription: 'Global technology and consulting firm helping businesses modernize software and AI systems.' },
    startPrice: 1720, seed: 404,
    fundamentals: { fiscalPeriod: 'Sample Baseline (Non-Live)', marketCapCr: 740000, peRatio: 26.5, sectorPeRatio: 29.8, pbRatio: 8.1, roePct: 31.2, rocePct: 39.5, debtToEquity: 0.1, revenueGrowth3YrPct: 9.5, profitGrowth3YrPct: 8.4, operatingMarginPct: 21.1, dividendYieldPct: 2.1, freeCashFlowCr: 24100, sourceName: 'Phase 1 Sample Fixture', sourceUrl: 'https://www.bseindia.com/', isSampleData: true },
    competitors: [{ nseSymbol: 'TCS', name: 'TCS Ltd.', marketCapCr: 1410000, peRatio: 28.4, roePct: 48.2, debtToEquity: 0.08 }],
    announcements: [{ id: '4', exchange: 'BSE' as const, category: 'Earnings', title: 'Sample Filing: Annual Revenue Guidance', plainSummary: 'Sample placeholder showing IT guidance update.', publishedAt: '2026-10-17T16:10:00+05:30', sourceName: 'Sample Placeholder', sourceUrl: 'https://www.bseindia.com/', isSampleData: true }],
  },
  {
    company: { isin: 'INE154A01025', nseSymbol: 'ITC', bseCode: '500875', name: 'ITC Ltd.', sector: 'Consumer Goods', industry: 'FMCG', plainDescription: 'Sells everyday household brands like Aashirvaad, Sunfeast, and Classmate across India.' },
    startPrice: 465, seed: 505,
    fundamentals: { fiscalPeriod: 'Sample Baseline (Non-Live)', marketCapCr: 590000, peRatio: 27.9, sectorPeRatio: 42.0, pbRatio: 8.0, roePct: 28.4, rocePct: 36.2, debtToEquity: 0.01, revenueGrowth3YrPct: 8.9, profitGrowth3YrPct: 11.4, operatingMarginPct: 34.5, dividendYieldPct: 2.9, freeCashFlowCr: 16400, sourceName: 'Phase 1 Sample Fixture', sourceUrl: 'https://www.bseindia.com/', isSampleData: true },
    competitors: [{ nseSymbol: 'HINDUNILVR', name: 'HUL', marketCapCr: 580000, peRatio: 54.2, roePct: 20.1, debtToEquity: 0.03 }],
