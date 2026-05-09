import { useEffect, useState } from "react";
import { SUPPORTED_TOKENS } from "../sdk/tokens";

const jupiterApiKey = import.meta.env.VITE_JUPITER_API_KEY as string | undefined;

const REFRESH_INTERVAL = 7;

const PRICE_TOKENS = SUPPORTED_TOKENS;

type JupiterPriceRow = Record<string, unknown>;
type JupiterPriceResponse = Record<string, JupiterPriceRow>;

function fmtLiquidity(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function ClockIcon({ countdown }: { countdown: number }) {
  const angle = ((REFRESH_INTERVAL - countdown) / REFRESH_INTERVAL) * 360;
  const rad = ((angle - 90) * Math.PI) / 180;
  const x = 12 + 8 * Math.cos(rad);
  const y = 12 + 8 * Math.sin(rad);
  const largeArc = angle > 180 ? 1 : 0;

  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      className="flex-shrink-0"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="#52525b" strokeWidth="1.5" />
      {angle > 0 && (
        <path
          d={`M12 12 L12 4 A8 8 0 ${largeArc} 1 ${x.toFixed(3)} ${y.toFixed(3)} Z`}
          fill="#7c3aed"
          opacity="0.5"
        />
      )}
      <line x1="12" y1="12" x2="12" y2="5.5" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="12" x2="16" y2="12" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.2" fill="#e4e4e7" />
    </svg>
  );
}

function TokenCard({
  symbol,
  mint,
  priceRow,
  loading,
}: {
  symbol: string;
  mint: string;
  priceRow: JupiterPriceRow | undefined;
  loading: boolean;
}) {
  const usdPrice = typeof priceRow?.usdPrice === "number" ? (priceRow.usdPrice as number) : null;
  const change = typeof priceRow?.priceChange24h === "number" ? (priceRow.priceChange24h as number) : null;
  const liquidity = typeof priceRow?.liquidity === "number" ? (priceRow.liquidity as number) : null;
  const positive = change !== null && change >= 0;
  const shortMint = `${mint.slice(0, 4)}...${mint.slice(-4)}`;

  return (
    <li className="token-card group min-w-0 rounded-xl border border-violet-700/30 bg-gradient-to-b from-violet-900/40 to-violet-950/60 p-4 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-wide text-violet-100">{symbol}</p>
          <p className="mt-0.5 font-mono text-[11px] text-violet-400/50" title={mint}>
            {shortMint}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            change !== null
              ? positive
                ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/25"
                : "bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/25"
              : "bg-violet-500/10 text-violet-400/60 ring-1 ring-violet-500/20"
          }`}
        >
          {change !== null
            ? `${positive ? "▲" : "▼"} ${Math.abs(change).toFixed(2)}%`
            : "—"}
        </span>
      </div>

      <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-violet-50">
        {usdPrice !== null
          ? `$${usdPrice.toFixed(usdPrice >= 1 ? 2 : 6)}`
          : loading
            ? "—"
            : "N/A"}
      </p>

      <div className="mt-4 flex items-center justify-between border-t border-violet-800/30 pt-3 text-xs">
        <span className="text-violet-400/70">Liquidity</span>
        <span className="font-mono text-violet-100">
          {liquidity !== null
            ? fmtLiquidity(liquidity)
            : priceRow
              ? "—"
              : loading
                ? "Loading…"
                : "No data"}
        </span>
      </div>
    </li>
  );
}

export function Pricing() {
  const [prices, setPrices] = useState<JupiterPriceResponse>({});
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);

  useEffect(() => {
    let cancelled = false;
    const ids = PRICE_TOKENS.map((t) => t.mint).join(",");

    const fetchPrices = async () => {
      if (!jupiterApiKey) {
        if (!cancelled) {
          setLoading(false);
          setError("Set VITE_JUPITER_API_KEY in .env to load prices.");
        }
        return;
      }

      try {
        if (!cancelled) setError(null);

        const res = await fetch(
          `https://api.jup.ag/price/v3?ids=${encodeURIComponent(ids)}`,
          { headers: { "x-api-key": jupiterApiKey } }
        );

        if (!res.ok) throw new Error(`Jupiter Price API failed (${res.status}).`);

        const data = (await res.json()) as JupiterPriceResponse;
        if (!cancelled) {
          setPrices(data);
          setUpdatedAt(new Date().toLocaleTimeString());
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch prices.");
          setLoading(false);
        }
      }
    };

    void fetchPrices();
    const intervalId = window.setInterval(() => void fetchPrices(), REFRESH_INTERVAL * 1000);
    return () => { cancelled = true; window.clearInterval(intervalId); };
  }, []);

  useEffect(() => {
    setCountdown(REFRESH_INTERVAL);
    const tickId = window.setInterval(
      () => setCountdown((c) => (c <= 1 ? REFRESH_INTERVAL : c - 1)),
      1000
    );
    return () => window.clearInterval(tickId);
  }, [updatedAt]);

  return (
    <section className="mt-6 rounded-2xl border border-violet-800/40 bg-violet-950/30 p-8 shadow-lg shadow-violet-950/40 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-violet-400">
          Jupiter Prices
        </h2>
        <div className="flex items-center gap-2">
          <ClockIcon countdown={countdown} />
          <span className="text-xs text-violet-400/60">
            {updatedAt ? `Updated ${updatedAt} · ${countdown}s` : "Waiting for first update"}
          </span>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {PRICE_TOKENS.map((token) => (
          <TokenCard
            key={token.mint}
            symbol={token.symbol}
            mint={token.mint}
            priceRow={prices[token.mint]}
            loading={loading}
          />
        ))}
      </ul>
    </section>
  );
}
