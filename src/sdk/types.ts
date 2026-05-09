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
