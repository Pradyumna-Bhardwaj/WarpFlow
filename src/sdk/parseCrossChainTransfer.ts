import type { ParsedCrossChainTransferCommand } from "./types";

const BRIDGE_PATTERN =
  /^bridge\s+(?:(\d+(?:\.\d+)?)\s+)?(\w+)\s+to\s+(\w+)(?:\s+(0x[a-fA-F0-9]{40}))?\s*$/i;

function normalizeAsset(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (s === "sol" || s === "solana") return "sol";
  if (s === "eth" || s === "ethereum") return "eth";
  return s;
}

export function parseCrossChainTransferCommand(input: string):
  | { ok: true; command: ParsedCrossChainTransferCommand }
  | { ok: false; error: string } {
  const match = BRIDGE_PATTERN.exec(input.trim());
  if (!match) {
    return {
      ok: false,
      error:
        "Try: bridge sol to eth — optional: amount before sol, optional 0x recipient at end, e.g. bridge 0.05 sol to eth 0xabc…",
    };
  }

  const amountRaw = match[1];
  const fromRaw = match[2];
  const toRaw = match[3];
  const ethRaw = match[4];

  if (!fromRaw || !toRaw) {
    return { ok: false, error: "Could not parse source or destination." };
  }

  const fromAsset = normalizeAsset(fromRaw);
  const toAsset = normalizeAsset(toRaw);

  if (fromAsset !== "sol" || toAsset !== "eth") {
    return {
      ok: false,
      error:
        "This build only supports sol → eth. Example: bridge sol to eth",
    };
  }

  let amountSol: number | null = null;
  if (amountRaw) {
    const n = Number(amountRaw);
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false, error: "Amount must be a positive number." };
    }
    amountSol = n;
  }

  const recipientEth = ethRaw ? ethRaw.toLowerCase() : null;

  return {
    ok: true,
    command: {
      kind: "cross_chain_transfer",
      fromAsset,
      toAsset,
      amountSol,
      recipientEth,
    },
  };
}
