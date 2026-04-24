# The Hollow Halls

A VS Code extension that gives developers a spatial UI for orchestrating Claude-family agents. Each "room" is a discipline (design, code review, security, etc.) staffed by named agents with distinct personalities.

Status: **Milestone 2** (one agent talking inside her chamber). See [`BUILD_PLAN.md`](BUILD_PLAN.md) for the milestone ladder.

---

## Build & run

```bash
npm install
npm run build       # or: npm run watch
# F5 in VS Code → Extension Development Host → "Hollow Halls: Open"
```

---

## LLM providers

Three providers ship. Auto-detected on first use, configurable at `<workspace>/.hollow/settings.json` (or via **Hollow Halls: Edit Settings** from the Command Palette).

| Provider | What you need | Billing |
|---|---|---|
| **Claude Code CLI** (default if detected) | `claude` installed + `claude auth login` | Uses your Claude Max / Pro / Console subscription. No separate API key. |
| **Ollama** | `ollama serve` running + a pulled model | Free, local, offline. |
| **Anthropic API** | `sk-ant-…` key (added on first use, stored in VS Code SecretStorage) | Pay-per-token via [console.anthropic.com](https://console.anthropic.com/settings/keys). |

### Claude Code CLI (recommended for Max subscribers)

```bash
# Install Claude Code (see docs.claude.com for the current installer)
claude auth status     # should report loggedIn: true, subscriptionType: max
```

In `.hollow/settings.json`:
```json
{
  "defaultProvider": "claude-code",
  "providers": { "claude-code": { "defaultModel": "sonnet" } }
}
```

### Ollama

```bash
ollama serve                          # leave running
ollama pull gemma3:4b                 # or gemma4:26b, qwen2.5:14b, etc.
```

In `.hollow/settings.json`:
```json
{
  "defaultProvider": "ollama",
  "providers": {
    "ollama": {
      "host": "http://localhost:11434",
      "defaultModel": "gemma3:4b"
    }
  }
}
```

First prompt cold-loads the model (can take 20–30s). Subsequent prompts are fast.

### Anthropic API

Get a key at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys), add billing separately (Claude Max **does not** grant API access), then set:

```json
{
  "defaultProvider": "anthropic",
  "providers": { "anthropic": { "defaultModel": "claude-sonnet-4-6" } }
}
```

You'll be prompted for the key the first time a send hits the Anthropic provider; it is stored in VS Code `SecretStorage`.

### Per-agent overrides

Any agent can pin its own provider/model regardless of the default:

```json
{
  "defaultProvider": "claude-code",
  "agentOverrides": {
    "maya":  { "provider": "claude-code", "model": "sonnet" },
    "oren":  { "provider": "ollama",      "model": "gemma3:12b" },
    "oracle":{ "provider": "anthropic",   "model": "claude-haiku-4-5-20251001" }
  }
}
```

---

## Project docs

- [`PRD.md`](PRD.md) — what we're building and why
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — module layout and message protocol
- [`BUILD_PLAN.md`](BUILD_PLAN.md) — milestone ladder with acceptance tests
- [`CLAUDE.md`](CLAUDE.md) — rules for contributors (human or AI)

---

## License

MIT.
