import type { ProviderId } from '@/api/provider';

/**
 * Tracks spend per stream and per session.
 *
 * - Anthropic API: computed from input/output tokens at the model's listed
 *   rates (see PRICING table below).
 * - Claude Code CLI: the CLI returns total_cost_usd on the terminal `result`
 *   event; we trust that and don't multiply tokens ourselves. For Max
 *   subscribers the cost is effectively zero (rate-limited, not metered),
 *   but the stream still reports a dollar figure for transparency.
 * - Ollama: free — cost is always 0.
 *
 * If a model id is unknown to the pricing table we fall back to Sonnet rates
 * (the safest over-estimate for Anthropic) so the meter never silently lies
 * *downward*.
 */

export interface SpendEntry {
  readonly roomId: string;
  readonly agentId: string;
  readonly provider: ProviderId;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUSD: number;
  readonly at: number;
}

/** Input/output USD per 1M tokens. */
interface Rate { readonly input: number; readonly output: number; }

const PRICING: Record<string, Rate> = {
  // Anthropic current list prices as of 2026-04.
  'claude-sonnet-4-6':            { input: 3,  output: 15 },
  'claude-opus-4-7':              { input: 15, output: 75 },
  'claude-opus-4-7[1m]':          { input: 15, output: 75 },
  'claude-haiku-4-5-20251001':    { input: 1,  output: 5  },
};
const DEFAULT_RATE: Rate = { input: 3, output: 15 };

export class CostTracker {
  private entries: SpendEntry[] = [];
  private listeners = new Set<(total: number) => void>();

  record(entry: Omit<SpendEntry, 'at'>): SpendEntry {
    const full: SpendEntry = { ...entry, at: Date.now() };
    this.entries.push(full);
    const total = this.sessionTotal;
    this.listeners.forEach((fn) => fn(total));
    return full;
  }

  get sessionTotal(): number {
    return this.entries.reduce((sum, e) => sum + e.costUSD, 0);
  }

  get sessionEntries(): readonly SpendEntry[] {
    return this.entries;
  }

  onChange(fn: (total: number) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  reset(): void {
    this.entries = [];
    this.listeners.forEach((fn) => fn(0));
  }
}

/**
 * Compute cost for a single stream's tokens. Use the provider-reported cost
 * when available (Claude Code's total_cost_usd is authoritative for that
 * provider); otherwise compute from rates.
 */
export function costForStream(args: {
  provider: ProviderId;
  model: string;
  inputTokens: number;
  outputTokens: number;
  providerReportedCostUSD?: number;
}): number {
  if (args.provider === 'ollama') return 0;
  if (args.provider === 'claude-code' && typeof args.providerReportedCostUSD === 'number') {
    return args.providerReportedCostUSD;
  }
  const rate = PRICING[args.model] ?? DEFAULT_RATE;
  return (args.inputTokens / 1_000_000) * rate.input
       + (args.outputTokens / 1_000_000) * rate.output;
}

/** Format a dollar amount for status-bar/transcript UI. */
export function formatCost(usd: number): string {
  if (usd === 0) return '$0.00';
  if (usd < 0.01) return '< $0.01';
  if (usd < 1) return `$${usd.toFixed(3).slice(0, 5)}`;
  return `$${usd.toFixed(2)}`;
}
