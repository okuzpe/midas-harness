# Security

This document covers two things: how to report a vulnerability in Midas itself, and how to configure
the MCP servers Midas ships with as securely as possible.

---

## Reporting a vulnerability

**Do not file a public GitHub issue for security vulnerabilities.**

Send a private report via GitHub's [Security Advisories](https://github.com/okuzpe/midas-harness/security/advisories/new)
feature (Repository → Security → Advisories → New draft advisory).

Include:
- A clear description of the vulnerability and its potential impact.
- Steps to reproduce (skill name, config excerpt, or `.mcp.json` snippet).
- The Midas version (`midas_version` in `harness/state.yaml`) and tool/platform.
- Whether you have a proposed fix or patch.

We aim to acknowledge reports within 3 business days and to publish a patch or advisory within
30 days for confirmed issues. We will credit reporters in the advisory unless you request anonymity.

---

## Installing Midas securely

Midas's recommended one-line installers **execute a remote script with your user's privileges**:

```bash
curl -fsSL https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.sh | bash
# Windows: irm https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.ps1 | iex
```

This is *pipe-to-shell* — you run code you haven't read. Treat it like any `curl | bash`:

- **Read it first** if that's a concern: [`install.sh`](./install.sh) / [`install.ps1`](./install.ps1)
  are thin shims that only check Node and delegate to `npx`.
- **Prefer the `npx` form**, which runs the same dependency-free installer without a shell pipe:
  `npx github:okuzpe/midas-harness`.
- **Pin a release for a reproducible, reviewable install.** The shims and `npx` resolve from the
  mutable `main` branch (not a signed tag), so for supply-chain assurance install a tagged version:
  `npx github:okuzpe/midas-harness#v0.4.0`.
- The installer is **non-destructive** (only adds files, never deletes) and writes **no secrets**.

---

## MCP least-privilege guidance

Midas ships a secret-free [`.mcp.json`](./.mcp.json) that wires two servers by default:

| Server | Type | What it does |
|---|---|---|
| `context7` | Remote HTTP | Fetches live library documentation |
| `sequential-thinking` | Local npx | Structured reasoning; no file or network access |

The following guidance applies when you extend `.mcp.json` with optional servers.

### 1. Pin package versions; never use bare `@latest` on write or exec servers

`@latest` resolves at install time. For servers that can write files, execute commands, or make
network requests, a supply-chain compromise in a later package version would run silently.

```jsonc
// Avoid — version is unbounded
"args": ["-y", "@modelcontextprotocol/server-filesystem@latest"]

// Prefer — explicit version, review diffs on upgrade
"args": ["-y", "@modelcontextprotocol/server-filesystem@0.6.2"]
```

Read-only, vendor-maintained servers with no file/exec scope are lower risk; pinning is still
recommended for reproducibility.

### 2. Prefer vendor-maintained servers over community forks for sensitive scopes

For servers with write, exec, git, or GitHub scopes, prefer:
- Official `@modelcontextprotocol/server-*` packages (maintained by Anthropic).
- First-party vendor packages (e.g., the official GitHub MCP server from GitHub, Inc.).

Audit the source of any community server before granting it write or exec permissions. Check the
npm provenance attestation if available.

### 3. Secrets only via `${ENV_VAR}` — never hardcode credentials in `.mcp.json`

`.mcp.json` is committed to git. Any literal API key, token, or password in this file will be
exposed in the repository history.

```jsonc
// Wrong — key is committed and leaked
"env": { "GITHUB_TOKEN": "ghp_XXXXXXXXXXXX" }

// Correct — key lives in the shell environment; .mcp.json is safe to commit
"env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
```

Set secrets in your shell profile, a local `.env` file that is gitignored, or your tool's
secrets manager. Never commit a `.env` file.

### 4. Remote MCP endpoints send data to third parties — understand the scope

The `context7` HTTP endpoint (`https://mcp.context7.com/mcp`) is a remote service. Library IDs
and documentation queries are transmitted to Context7's servers. This is intentional and necessary
for live-doc fetching; however:

- Do not pass proprietary source code, internal library names, or sensitive identifiers to Context7
  queries beyond what is needed to resolve a public library ID.
- If operating in an air-gapped or high-compliance environment, substitute a self-hosted or
  offline documentation server and update the `url` in `.mcp.json`.

### 5. Filesystem and git MCP servers: apply least-privilege scope

If you add an MCP server with filesystem or git access, restrict its allowed paths to the minimum
required. Granting root or home-directory access is almost never necessary for a single project.

```jsonc
// Overly broad — grants access to the entire home directory
"args": ["--allowed-directories", "/Users/you"]

// Prefer — scoped to this project only
"args": ["--allowed-directories", "/Users/you/my-product"]
```

Similarly, restrict git MCP access to the project repository, not system-wide git config or
credential stores.

### 6. Playwright / browser MCP servers: headless only in CI

Browser-control MCP servers can render arbitrary web content. In CI or automated environments:
- Run in headless mode only.
- Do not grant access to browser profiles that store passwords or session cookies.
- Scope to a dedicated browser profile with no saved credentials.

---

## Harness-level security conventions

These apply to all harness artifacts and generated code:

- **No secrets on disk.** Skills and agents must never write API keys, tokens, or passwords to
  any file. `${ENV_VAR}` references only.
- **Treat external input as untrusted.** Code generated during Phase 7 must validate at all
  boundaries (API responses, user input, file content). See `harness/conventions.md`.
- **Never log secrets.** Error messages and audit logs must redact credentials. If a tool echoes
  environment variables, check that secrets are not surfaced in `.harness/audits/`.
- **Commit hygiene.** `git` history is permanent. The `.gitignore` at the root of this repo
  excludes common secret patterns; extend it if your project adds environment files.

---

## Audit findings (2026 baseline)

The following findings were recorded during the 2026 security audit of the v0.1 baseline:

| ID | Finding | Disposition |
|---|---|---|
| SEC-001 | `sequential-thinking` server pinned via `-y` without version lock; low risk (no file/exec scope) | Accepted; monitor for supply-chain advisories; pin if scope expands |
| SEC-002 | `context7` remote endpoint receives library-ID queries; no auth required | Accepted; documented in guidance §4 above |
| SEC-003 | No version pin guidance in the default `.mcp.json` for optional servers | Mitigated: guidance added in this document (§1) |
| SEC-004 | `${ENV_VAR}` pattern not enforced by tooling; relies on author discipline | Mitigated: documented in `harness/conventions.md`; Phase-8 audit checklist item |
| SEC-005 | `curl\|bash` / `irm\|iex` installers pipe a remote script from the mutable `main` branch | Documented (§Installing Midas securely); `npx` and pinned-tag (`#v0.4.0`) alternatives provided |
