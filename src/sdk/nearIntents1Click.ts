/**
 * NEAR Intents 1Click REST API — cross-chain quotes and execution status.
 * @see https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart
 */

const ONECLICK_BASE = "https://1click.chaindefuser.com/v0";

/** From GET /v0/tokens — SOL on Solana + native ETH on Ethereum (mainnet). */
export const DEFAULT_ORIGIN_SOL = "nep141:sol.omft.near";
export const DEFAULT_DEST_ETH = "nep141:eth.omft.near";

const SOL_DECIMALS = 9;
const ETH_DECIMALS = 18;

const apiKey = import.meta.env.VITE_ONECLICK_JWT as string | undefined;

export type OneClickSwapStatus =
  | "KNOWN_DEPOSIT_TX"
  | "PENDING_DEPOSIT"
  | "INCOMPLETE_DEPOSIT"
  | "PROCESSING"
  | "SUCCESS"
  | "REFUNDED"
  | "FAILED";

export interface OneClickQuoteResponse {
  correlationId: string;
  timestamp: string;
  signature: string;
  quoteRequest: Record<string, unknown>;
  quote: {
    depositAddress?: string;
    depositMemo?: string;
    amountIn: string;
    amountInFormatted: string;
    amountInUsd: string;
    minAmountIn: string;
    amountOut: string;
    amountOutFormatted: string;
    amountOutUsd: string;
    minAmountOut: string;
    timeEstimate: number;
    deadline?: string;
    timeWhenInactive?: string;
  };
}

function authHeaders(): HeadersInit {
  const h: HeadersInit = { "Content-Type": "application/json" };
  if (apiKey) {
    return { ...h, Authorization: `Bearer ${apiKey}` };
  }
  return h;
}

/** API accepts lowercase 40-hex 0x addresses for ETH destinations. */
export function normalizeEthereumRecipient(address: string): string {
  const t = address.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(t)) {
    throw new Error("Enter a valid 40-character Ethereum address (0x…).");
  }
  return t.toLowerCase();
}

export function solToAtomicLamports(amountSol: number): bigint {
  const factor = 10 ** SOL_DECIMALS;
  return BigInt(Math.round(amountSol * factor));
}

export function fromAtomicWei(atomic: string | bigint): number {
  const value = typeof atomic === "string" ? BigInt(atomic) : atomic;
  const factor = BigInt(10 ** ETH_DECIMALS);
  const whole = value / factor;
  const frac = value % factor;
  return Number(whole) + Number(frac) / Number(factor);
}

export interface FetchOneClickQuoteParams {
  amountLamports: bigint;
  recipientEthNormalized: string;
  refundSolanaBase58: string;
  dry: boolean;
  slippageBps?: number;
}

export async function fetchOneClickQuote(
  params: FetchOneClickQuoteParams
): Promise<OneClickQuoteResponse> {
  const deadline = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const body = {
    dry: params.dry,
    depositMode: "SIMPLE" as const,
    swapType: "EXACT_INPUT" as const,
    slippageTolerance: params.slippageBps ?? 100,
    originAsset: DEFAULT_ORIGIN_SOL,
    depositType: "ORIGIN_CHAIN" as const,
    destinationAsset: DEFAULT_DEST_ETH,
    amount: params.amountLamports.toString(),
    recipient: params.recipientEthNormalized,
    recipientType: "DESTINATION_CHAIN" as const,
    refundTo: params.refundSolanaBase58,
    refundType: "ORIGIN_CHAIN" as const,
    deadline,
    quoteWaitingTimeMs: 0,
  };

  const res = await fetch(`${ONECLICK_BASE}/quote`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = text;
    try {
      const j = JSON.parse(text) as { message?: string };
      if (j.message) message = j.message;
    } catch {
      /* use raw */
    }
    throw new Error(`1Click quote failed (${res.status}): ${message || res.statusText}`);
  }

  return res.json() as Promise<OneClickQuoteResponse>;
}

export async function submitDepositTxHash(params: {
  depositAddress: string;
  txHash: string;
}): Promise<void> {
  const res = await fetch(`${ONECLICK_BASE}/deposit/submit`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      depositAddress: params.depositAddress,
      txHash: params.txHash,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Deposit submit failed (${res.status}): ${text || res.statusText}`);
  }
}

export async function fetchExecutionStatus(params: {
  depositAddress: string;
  depositMemo?: string;
}): Promise<{ status: OneClickSwapStatus; raw: unknown }> {
  const q = new URLSearchParams({ depositAddress: params.depositAddress });
  if (params.depositMemo) q.set("depositMemo", params.depositMemo);
  const res = await fetch(`${ONECLICK_BASE}/status?${q}`, { headers: authHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Status failed (${res.status}): ${text || res.statusText}`);
  }
  const raw = await res.json();
  const status = (raw as { status?: OneClickSwapStatus }).status;
  if (!status) {
    throw new Error("Unexpected status response.");
  }
  return { status, raw };
}
