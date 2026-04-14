import type { Candle, Timeframe } from '@sven/trading-platform/market-data';

export const BINANCE_SYMBOL_MAP: Record<string, string> = {
  'BTC/USDT': 'BTCUSDT', 'ETH/USDT': 'ETHUSDT', 'SOL/USDT': 'SOLUSDT',
  'BNB/USDT': 'BNBUSDT', 'XRP/USDT': 'XRPUSDT',
};

export async function fetchBinanceCandles(binanceSymbol: string, interval = '1h', limit = 100): Promise<Candle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(binanceSymbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance klines ${res.status}`);
  const raw = (await res.json()) as unknown[][];
  return raw.map((k) => ({
    time: new Date(k[0] as number),
    symbol: binanceSymbol,
    exchange: 'binance' as const,
    timeframe: interval as Timeframe,
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
  }));
}

export async function fetchBinancePrice(binanceSymbol: string): Promise<number> {
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(binanceSymbol)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance price ${res.status}`);
  const data = (await res.json()) as { price: string };
  return parseFloat(data.price);
}

export async function validateBinanceSymbol(binanceSymbol: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(binanceSymbol)}`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}
