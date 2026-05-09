import { useCommandPalette } from "../sdk/CommandPaletteContext";

const GITHUB_URL = "https://github.com/Pradyumna-Bhardwaj/WarpFlow";

export function Hero() {
  const { setOpen } = useCommandPalette();

  return (
    <section className="relative flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center py-20 text-center sm:py-28">
      {/* <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-950/40 px-3 py-1 text-xs font-medium text-violet-300 backdrop-blur-sm">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/60" />
        </span>
        Live on Solana Devnet
      </div> */}

      <h1 className="mt-6 max-w-3xl bg-gradient-to-br from-white via-violet-100 to-violet-300 bg-clip-text pb-2 text-4xl font-semibold leading-[1.08] tracking-tight text-transparent sm:text-5xl md:text-6xl">
        Move money at the speed of light on Solana.
      </h1>

      <p className="mt-6 max-w-2xl text-base text-violet-300/70 sm:text-lg">
        Transfers, swaps, and bridging from a single command palette. Type what
        you want, sign with your wallet, ship.
      </p>

      <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-cmd-palette inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <kbd className="ml-1 inline-flex h-5 items-center rounded-md border border-white/25 bg-white/10 px-1.5 font-mono text-[11px] text-white/90">
            ⌘K
          </kbd>
          Open Warp Palette
        </button>

        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="btn-github inline-flex items-center gap-2 rounded-xl border border-violet-500/25 bg-violet-950/30 px-5 py-2.5 text-sm font-medium text-violet-200 backdrop-blur-sm transition hover:border-violet-400/60 hover:bg-violet-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <GitHubIcon />
          View on GitHub
        </a>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-violet-400/50">
        <span className="text-[10px] font-medium uppercase tracking-[0.2em]">Scroll</span>
        <ChevronDown />
      </div>
    </section>
  );
}

function ChevronDown() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="animate-bounce"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}
