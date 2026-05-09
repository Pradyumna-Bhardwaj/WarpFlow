import type { WalletContextState } from "@solana/wallet-adapter-react";
import type { SolanaWalletClient } from "./types";

export function walletClientFromAdapter(
  wallet: Pick<WalletContextState, "publicKey" | "sendTransaction">
): SolanaWalletClient {
  return {
    publicKey: wallet.publicKey,
    sendTransaction(transaction, connection, options) {
      return wallet.sendTransaction(transaction, connection, options);
    },
  };
}
