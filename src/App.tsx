import { useState } from 'react';
import { StoreProvider, useStore } from './lib/store';
import { SessionProvider } from './lib/session';
import { LangProvider, useT } from './lib/i18n';
import { useIsMobile } from './lib/useMedia';
import { Lock, Setup } from './screens/Gate';
import { DesktopShell, type View } from './screens/DesktopShell';
import { MobileShell } from './screens/MobileShell';
import { ToastStack } from './components/ui';

/**
 * Routing is by vault status, not by URL: locked shows the gate, unlocked
 * shows the shell for the current screen size. The two shells keep their own
 * navigation state so switching breakpoints never loses your place.
 */
export default function App() {
  return (
    <LangProvider>
      <StoreProvider>
        <SessionProvider>
          <Root />
        </SessionProvider>
      </StoreProvider>
    </LangProvider>
  );
}

function Root() {
  const { status, lock } = useStore();
  const isMobile = useIsMobile();
  const { t } = useT();

  const [view, setView] = useState<View>({ kind: 'all' });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (status === 'loading') {
    return (
      <div className="gate">
        <div className="gate-card" style={{ alignItems: 'center' }}>
          <div className="gate-rings">
            <span />
            <span />
            <div className="gate-core">
              <span className="sync-dot" style={{ width: 10, height: 10 }} />
            </div>
          </div>
          <p className="gate-sub" style={{ textAlign: 'center' }}>
            {t('app.loading')}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'setup') {
    return (
      <>
        <Setup />
        <ToastStack />
      </>
    );
  }

  if (status === 'locked') {
    return (
      <>
        <Lock />
        <ToastStack />
      </>
    );
  }

  return (
    <>
      {isMobile ? (
        <MobileShell onLock={lock} />
      ) : (
        <DesktopShell
          view={view}
          setView={setView}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          onLock={lock}
        />
      )}
      <ToastStack />
    </>
  );
}
