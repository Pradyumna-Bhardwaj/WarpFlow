import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import {
  CommandPaletteProvider,
  walletClientFromAdapter,
} from "./sdk/index";
import { Pricing } from "./components/Pricing";
import { WarpGrid } from "./components/WarpGrid";
import { Hero } from "./components/Hero";

const network = WalletAdapterNetwork.Devnet;
const endpoint = clusterApiUrl(network);

function Shell() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const walletClient = useMemo(
    () => walletClientFromAdapter(wallet),
    [wallet]
  );

  return (
    <CommandPaletteProvider
      connection={connection}
      walletClient={walletClient}
    >
      <WarpGrid />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-8 py-10">
        <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/warpflow-logo.png"
              alt="WarpFlow"
              className="h-9 w-9 rounded-lg object-cover ring-1 ring-violet-500/30 shadow-lg shadow-violet-900/40"
            />
            <span className="text-base font-semibold tracking-tight text-violet-100">
              WarpFlow
            </span>
          </div>
          <WalletMultiButton className="!bg-violet-600 hover:!bg-violet-500" />
        </header>

        <Hero />

        <section className="rounded-2xl border border-violet-800/40 bg-violet-950/30 p-8 shadow-lg shadow-violet-950/40 backdrop-blur-sm">
          <h2 className="text-sm font-medium uppercase tracking-wide text-violet-400">
            Try it
          </h2>
          <p className="mt-3 text-violet-100/80">
            Press{" "}
            <kbd className="rounded border border-violet-700/50 bg-violet-900/50 px-2 py-0.5 font-mono text-xs text-violet-200">
              ⌘+K
            </kbd>{" "}
            or{" "}
            <kbd className="rounded border border-violet-700/50 bg-violet-900/50 px-2 py-0.5 font-mono text-xs text-violet-200">
              Ctrl+K
            </kbd>{" "}
            to open the palette, connect your wallet, then run a transfer
            command.
          </p>
          <ul className="mt-6 list-inside list-disc space-y-2 text-sm text-violet-300/70">
            <li>Uses your injected wallet for signing (Phantom, Solflare, …)</li>
            <li>Commands like: transfer 0.01 SOL to &lt;recipient&gt;</li>
          </ul>
        </section>

        <Pricing />
      </div>
    </CommandPaletteProvider>
  );
}

export default function App() {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Shell />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
