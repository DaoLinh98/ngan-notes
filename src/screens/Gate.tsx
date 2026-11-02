import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Button } from '../components/ui';
import { LangSwitch } from '../components/LangSwitch';
import { useStore } from '../lib/store';
import { strength } from '../lib/crypto';
import { useT, type TKey } from '../lib/i18n';

/**
 * Everything the user meets before the vault opens: first-run setup, the
 * desktop lock card, and the mobile biometric prompt. The vault is the only
 * thing standing between a borrowed device and the user's passwords, so all
 * three are deliberately plain and hard to fumble.
 */

const GUARDS: { t: TKey; d: string }[] = [
  { t: 'gate.guard1', d: 'M12 21a9 9 0 1 1 0-18a9 9 0 0 1 0 18z M12 7v5l3 2' },
  { t: 'gate.guard2', d: 'M3 5h13v10H3z M7 19h5 M18 9h3v10h-3z' },
  {
    t: 'gate.guard3',
    d: 'M3 3l18 18 M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9 M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6',
  },
];

function GuardPills() {
  const { t } = useT();
  return (
    <div className="guard-row">
      {GUARDS.map((g) => (
        <span className="guard-pill" key={g.t}>
          <Icon name="shield" size={15} />
          {t(g.t)}
        </span>
      ))}
    </div>
  );
}

/** First run: choose the master password that encrypts everything. */
export function Setup() {
  const { t } = useT();
  const { createVault } = useStore();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const s = strength(password);
  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;
  const ready = password.length >= 8 && confirm === password && !busy;

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setError('');
    try {
      await createVault(password);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('gate.createFail'));
      setBusy(false);
    }
  };

  return (
    <div className="gate">
      <LangSwitch />
      <div className="gate-card">
        <div className="gate-rings">
          <span />
          <span />
          <div className="gate-core">
            <Icon name="lock" size={26} strokeWidth={2} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 className="gate-title">{t('gate.setupTitle')}</h1>
          <p className="gate-sub">{t('gate.setupSub', { app: t('app.name') })}</p>
        </div>

        <div className="gate-form">
          <label className="gate-label" htmlFor="mp-new">
            {t('gate.master')}
          </label>
          <div className="input-wrap">
            <input
              id="mp-new"
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="new-password"
              placeholder={t('gate.minChars')}
            />
            <button
              type="button"
              className="icon-btn"
              style={{ width: 38, height: 38 }}
              aria-label={show ? t('gate.hideMaster') : t('gate.showMaster')}
              onClick={() => setShow((v) => !v)}
            >
              <Icon name={show ? 'eyeoff' : 'eye'} />
            </button>
          </div>

          {password && (
            <div className="strength">
              <div className="strength-bars">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    style={{
                      background:
                        i < s.score
                          ? s.score >= 3
                            ? 'var(--accent)'
                            : s.score === 2
                              ? 'var(--warn)'
                              : 'var(--danger)'
                          : 'var(--border-strong)',
                    }}
                  />
                ))}
              </div>
              <span className="strength-label">{s.label}</span>
            </div>
          )}

          <label className="gate-label" htmlFor="mp-confirm" style={{ marginTop: 6 }}>
            {t('gate.confirm')}
          </label>
          <input
            id="mp-confirm"
            className="input is-mono"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
          />

          {tooShort && <p className="error-text">{t('gate.tooShort')}</p>}
          {mismatch && <p className="error-text">{t('gate.mismatch')}</p>}
          {error && <p className="error-text">{error}</p>}

          <Button variant="primary" size="lg" full disabled={!ready} onClick={() => void submit()}>
            {busy ? t('gate.encrypting') : t('gate.create')}
          </Button>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {t('gate.crypto')}
        </p>
      </div>

      <GuardPills />
    </div>
  );
}

/** Desktop lock screen: biometric shortcut plus the master password fallback. */
export function Lock() {
  const { t } = useT();
  const { unlock, unlockWithBiometric, reset, settings } = useStore();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      await unlock(password);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('gate.openFail'));
      setPassword('');
      setBusy(false);
    }
  };

  return (
    <div className="gate">
      <LangSwitch />
      <div className="gate-card">
        <div className="gate-rings">
          <span />
          <span />
          <div className="gate-core">
            <Icon name="lock" size={26} strokeWidth={2} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 className="gate-title">{t('gate.lockedTitle')}</h1>
          <p className="gate-sub">{t('gate.lockedSub')}</p>
        </div>

        {settings.biometric && (
          <>
            <Button variant="primary" size="lg" full icon="finger" onClick={unlockWithBiometric}>
              {t('gate.touchId')}
            </Button>
            <div className="divider-text">{t('gate.orPassword')}</div>
          </>
        )}

        <div className="gate-form">
          <label className="gate-label" htmlFor="mp">
            {t('gate.master')}
          </label>
          <div className="input-wrap">
            <input
              id="mp"
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              autoFocus
              autoComplete="current-password"
            />
            <button
              type="button"
              className="icon-btn"
              style={{ width: 38, height: 38 }}
              aria-label={show ? t('gate.hideMaster') : t('gate.showMaster')}
              onClick={() => setShow((v) => !v)}
            >
              <Icon name={show ? 'eyeoff' : 'eye'} />
            </button>
          </div>
          {error && <p className="error-text">{error}</p>}
          <Button size="lg" full onClick={() => void submit()} disabled={!password || busy}>
            {busy ? t('gate.opening') : t('gate.open')}
          </Button>
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (window.confirm(t('gate.resetConfirm'))) {
              void reset();
            }
          }}
        >
          {t('gate.forgot')}
        </button>
      </div>

      <GuardPills />
    </div>
  );
}

/** Mobile vault unlock: a big biometric target, PIN as the fallback. */
export function MobileUnlock({ onBack }: { onBack: () => void }) {
  const { unlockWithBiometric } = useStore();
  const { t } = useT();
  const [scanning, setScanning] = useState(false);

  const scan = () => {
    setScanning(true);
    // A real build awaits the platform authenticator here.
    window.setTimeout(() => {
      setScanning(false);
      unlockWithBiometric();
    }, 900);
  };

  return (
    <div className="mobile">
      <div
        className="mobile-scroll"
        style={{ alignItems: 'center', gap: 28, paddingTop: 72, paddingBottom: 34 }}
      >
        <div style={{ alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}>
          <button type="button" className="round-btn" aria-label={t('shell.back')} onClick={onBack}>
            <Icon name="left" size={20} strokeWidth={2} />
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            textAlign: 'center',
            paddingTop: 20,
          }}
        >
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 28,
              padding: '0 12px',
              borderRadius: 999,
              background: 'var(--k-login-bg)',
              color: 'var(--k-login)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <Icon name="lock" size={14} strokeWidth={2} />
            {t('nav.vault')}
          </span>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {t('shell.unlockTitle')}
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--text-dim)', maxWidth: 280 }}>
            {t('shell.unlockSub', { n: 109 })}
          </p>
        </div>

        <button
          type="button"
          className={`biometric${scanning ? ' is-scanning' : ''}`}
          aria-label={t('shell.faceId')}
          onClick={scan}
        >
          <span className="ring-dash" />
          <span className="ring-solid" />
          <span className="core">
            <Icon name="face" size={56} strokeWidth={1.4} />
          </span>
        </button>
        <span style={{ fontSize: 15, fontWeight: 500 }}>
          {scanning ? t('shell.scanning') : t('shell.tapFaceId')}
        </span>

        <div
          style={{
            marginTop: 'auto',
            alignSelf: 'stretch',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <Button size="lg" full onClick={onBack}>
            {t('shell.usePin')}
          </Button>
          <p
            style={{
              textAlign: 'center',
              fontSize: 13,
              lineHeight: 1.5,
              color: 'var(--text-dim)',
            }}
          >
            {t('shell.unlockNote1')}
            <br />
            {t('shell.unlockNote2')}
          </p>
        </div>
      </div>
    </div>
  );
}
