import { useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Button, Field, SectionLabel } from '../components/ui';
import { downloadBackup } from '../lib/backup';
import { count, timeAgo } from '../lib/format';
import { isSeedItem } from '../lib/seed';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { useT, type Lang } from '../lib/i18n';
import type { Settings } from '../lib/types';

/**
 * Settings, split the way the design splits them: how the vault opens, how
 * long secrets live, and how the data is backed up. Every control writes
 * straight through to the encrypted payload.
 */
export function SettingsPane() {
  const {
    settings,
    updateSettings,
    items,
    folders,
    exportBackup,
    importBackup,
    addFolder,
    changeMasterPassword,
    removeSeedItems,
    backupFileName,
    canPickBackupFile,
    chooseBackupFile,
  } = useStore();
  const { notify } = useSession();
  const { t, lang, setLang } = useT();
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // The demo content a new vault ships with. Once it is gone this stays 0 and
  // the row below disappears.
  const seedCount = items.filter(isSeedItem).length;

  const savePassword = async () => {
    if (newPassword.length < 8) {
      setError(t('set.tooShort'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await changeMasterPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      notify(t('set.changed'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('set.changeFail'));
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    downloadBackup(exportBackup());
    notify(t('set.downloaded'));
  };

  const chooseFile = async () => {
    const name = await chooseBackupFile();
    if (name) notify(t('set.backupTargetSet', { name }));
  };

  const upload = async (file: File) => {
    try {
      await importBackup(await file.text());
      notify(t('set.imported'));
    } catch (e) {
      notify(e instanceof Error ? e.message : t('set.invalidFile'), 'warn');
    }
  };

  return (
    <div className="detail">
      <div className="detail-main">
        <div className="detail-head">
          <span className="detail-avatar" style={{ background: 'var(--surface-2)' }}>
            <Icon name="sliders" size={26} />
          </span>
          <div className="detail-titles">
            <h2>{t('set.title')}</h2>
            <div className="detail-meta">
              {t('set.meta', { items: count(items.length), folders: count(folders.length) })}
            </div>
          </div>
        </div>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SectionLabel>{t('set.security')}</SectionLabel>
          <div className="settings-card">
            <Toggle
              icon="lock"
              title={t('set.autoLock')}
              sub={t('set.autoLockSub', { n: settings.autoLockMinutes })}
              on={settings.autoLockMinutes > 0}
              onChange={(on) => updateSettings({ autoLockMinutes: on ? 5 : 0 })}
            />
            <Choice
              icon="clock"
              title={t('set.autoLockTime')}
              sub={t('set.autoLockTimeSub')}
              value={t('unit.minutes', { n: settings.autoLockMinutes })}
              options={[1, 5, 15, 30].map((m) => ({
                label: t('unit.minutes', { n: m }),
                on: settings.autoLockMinutes === m,
                pick: () => updateSettings({ autoLockMinutes: m }),
              }))}
            />
            <Toggle
              icon="eyeoff"
              title={t('set.hideOnBlur')}
              sub={t('set.hideOnBlurSub')}
              on={settings.hideOnBlur}
              onChange={(on) => updateSettings({ hideOnBlur: on })}
            />
            <Choice
              icon="eye"
              title={t('set.autoHide')}
              sub={t('set.autoHideSub')}
              value={t('unit.seconds', { n: settings.revealSeconds })}
              options={[5, 8, 15, 30].map((s) => ({
                label: t('unit.seconds', { n: s }),
                on: settings.revealSeconds === s,
                pick: () => updateSettings({ revealSeconds: s }),
              }))}
            />
            <Choice
              icon="copy"
              title={t('set.clipboard')}
              sub={t('set.clipboardSub')}
              value={t('unit.seconds', { n: settings.clipboardClearSeconds })}
              options={[15, 30, 60, 120].map((s) => ({
                label: t('unit.seconds', { n: s }),
                on: settings.clipboardClearSeconds === s,
                pick: () => updateSettings({ clipboardClearSeconds: s }),
              }))}
            />
            <Toggle
              icon="finger"
              title={t('set.biometric')}
              sub={t('set.biometricSub')}
              on={settings.biometric}
              onChange={(on) => updateSettings({ biometric: on })}
            />
          </div>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SectionLabel>{t('set.master')}</SectionLabel>
          <div className="settings-card" style={{ padding: 16, gap: 12 }}>
            <Field label={t('set.currentPassword')}>
              <input
                className="input is-mono"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                aria-label={t('set.currentPasswordAria')}
              />
            </Field>
            <Field label={t('set.newPassword')}>
              <input
                className="input is-mono"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                aria-label={t('set.newPasswordAria')}
              />
            </Field>
            {error && <p className="error-text">{error}</p>}
            <div className="detail-actions">
              <Button
                variant="primary"
                icon="check"
                disabled={busy || !currentPassword || !newPassword}
                onClick={() => void savePassword()}
              >
                {busy ? t('set.changeBusy') : t('set.change')}
              </Button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
              {t('set.changeNote')}
            </p>
          </div>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SectionLabel>{t('nav.folders')}</SectionLabel>
          <div className="settings-card">
            {folders.map((f) => (
              <div className="settings-row" key={f.id}>
                <span className="settings-icon" style={{ color: f.color }}>
                  <Icon name="folder" size={17} />
                </span>
                <span className="settings-main">
                  <span className="settings-title">{f.name}</span>
                  <span className="settings-sub">
                    {t('set.folderItems', { n: count(items.filter((i) => i.folderId === f.id).length) })}
                  </span>
                </span>
                <span className="settings-value" style={{ color: f.color }}>
                  <Icon name="right" size={16} />
                </span>
              </div>
            ))}
            <div className="settings-row">
              <span className="settings-icon">
                <Icon name="plus" size={17} />
              </span>
              <span className="settings-main">
                <span className="settings-title">{t('set.addFolder')}</span>
                <span className="settings-sub">{t('set.addFolderSub')}</span>
              </span>
              <Button
                size="sm"
                onClick={() => {
                  const name = window.prompt(t('set.folderPrompt'));
                  if (name?.trim()) {
                    addFolder(name.trim(), '#7AB8FF');
                    notify(t('set.folderAdded', { name: name.trim() }));
                  }
                }}
              >
                {t('set.add')}
              </Button>
            </div>
          </div>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SectionLabel>{t('set.backup')}</SectionLabel>
          <div className="settings-card">
            <Row
              icon="download"
              title={t('set.download')}
              sub={t('set.downloadSub')}
              action={
                <Button size="sm" icon="download" onClick={download}>
                  {t('set.downloadBtn')}
                </Button>
              }
            />
            <Toggle
              icon="history"
              title={t('set.autoBackup')}
              sub={t('set.autoBackupSub')}
              on={settings.autoBackup}
              onChange={(on) => updateSettings({ autoBackup: on })}
            />
            <Row
              icon="folder"
              title={t('set.backupTarget')}
              sub={
                canPickBackupFile
                  ? backupFileName
                    ? t('set.backupOverwrite', { name: backupFileName })
                    : t('set.backupPick')
                  : t('set.backupNoPick')
              }
              action={
                canPickBackupFile ? (
                  <Button size="sm" icon="folder" onClick={() => void chooseFile()}>
                    {backupFileName ? t('set.changeFile') : t('set.pickFile')}
                  </Button>
                ) : (
                  <span className="settings-value">Downloads</span>
                )
              }
            />
            <Row
              icon="upload"
              title={t('set.import')}
              sub={t('set.importSub')}
              action={
                <Button size="sm" icon="upload" onClick={() => fileRef.current?.click()}>
                  {t('set.pickFile')}
                </Button>
              }
            />
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = '';
              }}
            />
            <Row
              icon="cloud"
              title={t('set.sync')}
              sub={t('set.syncSub')}
              action={
                <Button size="sm" icon="devices" onClick={() => notify(t('set.syncOn'))}>
                  {t('set.syncDevices')}
                </Button>
              }
            />
            {seedCount > 0 && (
              <Row
                icon="trash"
                title={t('set.seed')}
                sub={t('set.seedSub', { n: count(seedCount) })}
                action={
                  <Button
                    size="sm"
                    variant="danger"
                    icon="trash"
                    onClick={() => {
                      if (
                        window.confirm(t('set.seedConfirm', { n: count(seedCount) }))
                      ) {
                        removeSeedItems();
                        notify(t('set.seedDone', { n: count(seedCount) }));
                      }
                    }}
                  >
                    {t('cred.delete')}
                  </Button>
                }
              />
            )}
          </div>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SectionLabel>{t('settings.appearance')}</SectionLabel>
          <div className="settings-card">
            <Choice
              icon="globe"
              title={t('settings.language')}
              sub={t('settings.language.sub')}
              value={t(lang === 'vi' ? 'lang.vi' : 'lang.en')}
              options={(['vi', 'en'] as Lang[]).map((l) => ({
                label: t(l === 'vi' ? 'lang.vi' : 'lang.en'),
                on: lang === l,
                pick: () => setLang(l),
              }))}
            />
            <Choice
              icon={settings.theme === 'dark' ? 'moon' : 'sun'}
              title={t('set.theme')}
              sub={t('settings.language.sub')}
              value={settings.theme === 'dark' ? t('set.dark') : t('set.light')}
              options={(
                [
                  { label: t('set.dark'), theme: 'dark' },
                  { label: t('set.light'), theme: 'light' },
                ] as { label: string; theme: Settings['theme'] }[]
              ).map((o) => ({
                label: o.label,
                on: settings.theme === o.theme,
                pick: () => updateSettings({ theme: o.theme }),
              }))}
            />
            <Row
              icon="history"
              title={t('set.lastUpdate')}
              sub={t('set.lastUpdateSub')}
              action={<span className="settings-value">{timeAgo(new Date().toISOString())}</span>}
            />
          </div>
        </section>
      </div>

      <aside className="aside">
        <div className="panel is-inverted">
          <div className="section-label" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {t('set.status')}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{t('set.protected')}</div>
          <div style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.5 }}>
            {t('set.protectedSub')}
          </div>
        </div>

        <div className="panel">
          <div className="section-label">{t('set.never', { app: t('app.name') })}</div>
          <div className="activity-row">{t('set.never1')}</div>
          <div className="activity-row">{t('set.never2')}</div>
          <div className="activity-row is-dim">{t('set.never3')}</div>
          <div className="panel-foot">{t('set.neverFoot')}</div>
        </div>
      </aside>
    </div>
  );
}

/* ── Rows ────────────────────────────────────────────────────────────── */

function Row({
  icon,
  title,
  sub,
  action,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  title: string;
  sub: string;
  action: React.ReactNode;
}) {
  return (
    <div className="settings-row">
      <span className="settings-icon">
        <Icon name={icon} size={17} />
      </span>
      <span className="settings-main">
        <span className="settings-title">{title}</span>
        <span className="settings-sub">{sub}</span>
      </span>
      {action}
    </div>
  );
}

function Toggle({
  icon,
  title,
  sub,
  on,
  onChange,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  title: string;
  sub: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="settings-row">
      <span className="settings-icon">
        <Icon name={icon} size={17} />
      </span>
      <span className="settings-main">
        <span className="settings-title">{title}</span>
        <span className="settings-sub">{sub}</span>
      </span>
      <button
        type="button"
        className={`switch${on ? ' is-on' : ''}`}
        role="switch"
        aria-checked={on}
        aria-label={title}
        onClick={() => onChange(!on)}
      >
        <span />
      </button>
    </div>
  );
}

/** A row whose value is picked from a short list of options. */
function Choice({
  icon,
  title,
  sub,
  value,
  options,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  title: string;
  sub: string;
  value: string;
  options: { label: string; on: boolean; pick: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="settings-row">
        <span className="settings-icon">
          <Icon name={icon} size={17} />
        </span>
        <span className="settings-main">
          <span className="settings-title">{title}</span>
          <span className="settings-sub">{sub}</span>
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {value}
          <Icon name={open ? 'close' : 'right'} size={14} />
        </button>
      </div>
      {open && (
        <div className="settings-row" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <div className="chip-row" style={{ padding: '4px 0' }}>
            {options.map((o) => (
              <button
                key={o.label}
                type="button"
                className={`chip${o.on ? ' is-active' : ''}`}
                onClick={() => {
                  o.pick();
                  setOpen(false);
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
