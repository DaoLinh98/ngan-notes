# Ngăn

A Vietnamese-language, local-only secure notes and password manager. Built with React 18, TypeScript, and Vite — no backend, no router, no state library. Every piece of data lives in a single encrypted blob in IndexedDB, and the master password never leaves memory or touches disk.

## Features

- **Local-only storage** — all data stays in the browser's IndexedDB; nothing is ever sent to a server.
- **Strong encryption** — PBKDF2-SHA256 (250,000 iterations) key derivation, AES-256-GCM authenticated encryption.
- **Six item kinds** — notes, logins, secrets, people, tasks, and links, each with its own icon and color.
- **Built-in TOTP (2FA)** — RFC 6238 time-based one-time codes generated live from a stored secret.
- **Password tools** — strength meter and a secure password generator.
- **Fast, typo-tolerant search** — accent- and case-insensitive (`khoa` matches `khoá`), with `type:`, `folder:`, `#tag`, and `@starred`/`@pinned` query syntax. Secrets are excluded from the search index by design.
- **Session security controls** — configurable idle auto-lock, clipboard auto-clear, reveal-then-re-mask timers, and hide-on-blur to protect content when switching apps.
- **Responsive dual UI** — a three-column desktop layout with a command palette (⌘K), and a dedicated single-column mobile layout with a bottom tab bar.
- **Light and dark themes.**

## Tech stack

- [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) for dev server and build
- Native Web Crypto API for all cryptographic operations
- IndexedDB for persistence
- Plain CSS (design tokens + BEM-ish class names), no CSS framework

## Getting started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

Starts the Vite dev server at `http://localhost:5173`. The server binds to `host: true`, so it's also reachable from another device on the same LAN (e.g. a phone) at your machine's local IP.

### Build

```bash
npm run build
```

Runs a full TypeScript build (`tsc -b`) followed by the Vite production build. Output goes to `dist/`.

### Type checking

```bash
npm run typecheck
```

This is the only automated check in the project — there is no test runner, linter, or formatter configured. Run it after any code change.

### Preview a production build

```bash
npm run preview
```

## Project structure

```
src/
  lib/
    crypto.ts    # PBKDF2 + AES-256-GCM, TOTP, password strength/generation
    store.tsx    # Decrypted payload, mutations, persistence to IndexedDB
    session.tsx  # Ephemeral session state: reveal timers, clipboard, auto-lock, toasts
    search.ts    # Query parsing and scoring
    kind.ts      # Registry of item kinds (label/color/icon)
  components/    # Desktop shell, mobile shell, item detail views, etc.
  styles/        # Design tokens, reset, and the main stylesheet
```

See [`CLAUDE.md`](./CLAUDE.md) for a deeper architectural walkthrough (vault lifecycle, encryption envelope, session security model, and UI conventions).

## Security notes

- The master password is **never stored anywhere** — not in IndexedDB, not in `localStorage`, not on any server. It exists only in memory while the vault is unlocked and is cleared on lock.
- Vault data (items, folders, settings) is encrypted as a single JSON payload with AES-256-GCM before every write.
- "Vault kinds" (`login`, `secret`, `person`) are masked by default in the UI and their secret values are deliberately excluded from search results.
- If the master password is lost and no backup exists, the vault data **cannot be recovered**.

## License

This project does not currently declare a license. All rights reserved by the author unless a license is added.
