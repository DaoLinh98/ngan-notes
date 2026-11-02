import { useT, type Lang } from '../lib/i18n';

/** VI | EN toggle pinned to the corner of the gate screens, before the vault opens. */
export function LangSwitch() {
  const { lang, setLang, t } = useT();
  return (
    <div className="lang-switch" role="group" aria-label={t('settings.language')}>
      {(['vi', 'en'] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          className={lang === l ? 'on' : ''}
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
