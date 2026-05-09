import type {
  Connection,
  PublicKey,
  SendOptions,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import type { TokenInfo } from "./tokens";

export interface SolanaWalletClient {
  publicKey: PublicKey | null;
  sendTransaction(
    transaction: Transaction | VersionedTransaction,
    connection: Connection,
    options?: SendOptions
  ): Promise<string>;
}

export interface ParsedTransferCommand {
  kind: "transfer_sol";
  amountSol: number;
  recipient: PublicKey;
}

export interface ParsedSwapCommand {
  kind: "swap";
  fromToken: TokenInfo;
  toToken: TokenInfo;
  amount: number | null;
}

/** NEAR Intents 1Click cross-chain route (e.g. sol → eth), parsed from the command palette. */
export interface ParsedCrossChainTransferCommand {
  kind: "cross_chain_transfer";
  /** Normalized token/chain id, e.g. "sol", "eth" */
  fromAsset: string;
  toAsset: string;
  amountSol: number | null;
  /** Optional 0x recipient from the typed command */
  recipientEth: string | null;
}
