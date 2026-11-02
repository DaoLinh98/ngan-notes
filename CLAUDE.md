# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Vite dev server on :5173, host: true (reachable from a phone on the LAN)
npm run build      # tsc -b && vite build
npm run typecheck  # tsc --noEmit — the only automated check in this repo
npm run preview    # serve the production build
```

There is no test runner, no linter, and no formatter configured. `npm run typecheck` is the verification gate; run it after any change. `tsconfig.json` sets `noUnusedLocals` and `noUnusedParameters`, so a leftover import fails the build.

The `@/*` → `src/*` alias is configured in both `vite.config.ts` and `tsconfig.json`, but every existing import is relative (`../lib/store`). Keep using relative imports.

## What this is

Ngăn — a Vietnamese-language, local-only secure notes and password app. React 18 + TypeScript + Vite, no router, no state library, no backend. All data lives in one encrypted blob in IndexedDB; the master password never leaves memory and is never persisted. All user-facing copy is Vietnamese, including code comments' subject matter and every toast/label; keep new UI strings Vietnamese.

## Architecture

### Vault lifecycle drives routing

`App.tsx` renders by vault status, not by URL. `StoreProvider` loads the IndexedDB blob on mount and sets status to `setup` (no vault) or `locked` (vault found); `unlock()` moves it to `unlocked`. `Root` then renders `Setup`, `Lock`, or the shell. There is no client-side router anywhere — the desktop shell holds a `View` union and the mobile shell holds a `Route` union, each in local `useState`, so switching breakpoints never loses your place.

### Encryption (`src/lib/crypto.ts`)

PBKDF2-SHA256 (250k iterations) → AES-256-GCM. The envelope (`Vault` in `types.ts`) holds the salt, two IVs, an encrypted `verifier` (a known plaintext, used to distinguish a wrong password from a corrupt file without decrypting the payload), and the encrypted JSON payload.

- `seal(password, payload)` — fresh salt + IVs, for a new vault or a password change.
- `reseal(password, sealed, payload)` — keeps the salt and verifier, so the password is unchanged; this is the hot path for every edit.
- `unseal(password, sealed)` — throws on a wrong password.

Also here: `strength()` (0–4 meter), `generatePassword()`, RFC 6238 `totp()` / `totpRemaining()` and the base32 decoder feeding the live 2FA rows.

### Store (`src/lib/store.tsx`) — the single source of truth

One context holds `status`, the decrypted `payload` (`items`/`folders`/`settings`), and every mutation. Two rules matter:

1. **Every mutation re-encrypts the whole payload and writes it to IndexedDB.** `mutate()` calls `persist()`, which calls `reseal()` and `saveVault()`. There is no partial write and no dirty tracking. `persist` reads the vault from `vaultRef`, not from state, to avoid a stale closure.
2. **The master password lives only in `passwordRef`** — a ref, cleared on `lock()`. If it is null, mutations update React state but skip persistence. `unlockWithBiometric()` deliberately bypasses the password (a stand-in for WebAuthn) and sets `unlockedByBiometric`, which the vault banner reads.

Theme is applied to `document.documentElement.dataset.theme`, which `tokens.css` keys off — this works before the vault is unlocked.

### Session (`src/lib/session.tsx`) — ephemeral, never persisted

Everything here is deliberately short-lived and enforced centrally rather than in components: which item secrets are currently revealed (with a `revealSeconds` re-mask timer), the clipboard wipe countdown (`clipboardClearSeconds`), the idle auto-lock timer (`autoLockMinutes`), blur-to-hide, the vault-open stopwatch, and the toast queue. Components call `toggleReveal` / `copy` / `notify`; they do not own these timers. Adding a security-timing behavior means adding it here.

### Two shells, one breakpoint

`useIsMobile()` is `(max-width: 860px)` — the same value as the `@media` breakpoint in `app.css`. `DesktopShell` is a three-column layout (nav / list / main) with a `View` union and a `⌘K` palette; `MobileShell` is a single column with a `Route` union, a bottom tab bar, and a dock. They are separate implementations, not one responsive layout — a feature added to one usually needs adding to the other. `ItemDetail` (desktop) and `MobileDetail` likewise duplicate the credential card.

### The kind system

Six kinds (`note`, `login`, `secret`, `person`, `task`, `link`) defined in `types.ts`. `VAULT_KINDS` (`login`, `secret`, `person`) is the security boundary: vault kinds are masked by default and their secrets are excluded from search. `lib/kind.ts` is the single registry of label/colour/icon per kind, and the same six colours are duplicated as CSS custom properties (`--k-note`, `--k-note-bg`, …) in `styles/tokens.css`. Changing a kind's colour means editing both. `components/Icon.tsx` holds every glyph as stroked 24×24 SVG paths.

### Search (`src/lib/search.ts`)

Query syntax is `loại:` / `type:`, `ngăn:` / `folder:`, `#nhãn`, `@quan trọng` / `@ghim`, plus free text. Everything is matched accent- and case-insensitively via `fold()` (NFD strip + `đ`→`d`), so `khoa` finds `khoá`. Scoring prefers title hits at an early offset, then body hits, then all-words prefix matches; pinned and starred items get a bonus. **Secrets are deliberately absent from the haystack** — search must never surface a password.

### Styling

Three stylesheets, imported in `main.tsx`: `tokens.css` (design tokens, both themes), `base.css` (reset), `app.css` (~2350 lines, organised by commented section — Shell, Nav, List column, Main column, Mobile, Reminders, Responsive, …). Class names are plain global BEM-ish strings, not CSS modules. Inline `style` objects are used freely for one-off geometry. Colours must come from tokens; the two themes are keyed off `:root[data-theme=…]`.

## Notes

- Unused exports that exist but are referenced nowhere: `generatePassword`, `MobileUnlock`, `VaultEmpty`, `KindChips`, `ReminderChip`, `NextReminder`, `isVaultView`, `sameKind`. `VaultPane`'s "Dọn mục yếu" and `ItemDetail`'s "Tạo mật khẩu mới" / "Lịch sử mật khẩu" are placeholder actions.
- `SEED_PAYLOAD` in `lib/seed.ts` is both the first-run content and the fallback payload state, so a freshly created vault starts with ~30 demo items.
- `tsconfig.tsbuildinfo` and `dist/` are build output and gitignored; this directory is not currently a git repository.
