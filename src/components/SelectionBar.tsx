import { Button, IconButton } from './ui';
import { count } from '../lib/format';
import { useT } from '../lib/i18n';

/**
 * The action bar shown while a list is in selection mode. Shared by both
 * shells — only the surrounding chrome differs, not the actions.
 */
export function SelectionBar({
  selected,
  total,
  onToggleAll,
  onDelete,
  onCancel,
}: {
  selected: number;
  /** Number of items in the current list, for the "chọn tất cả" affordance. */
  total: number;
  onToggleAll: () => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  const all = total > 0 && selected === total;

  return (
    <div className="selection-bar">
      <IconButton name="close" label={t('ui.sel.exit')} size={32} onClick={onCancel} />
      <span className="selection-count">
        {selected ? t('ui.sel.count', { n: count(selected) }) : t('ui.sel.prompt')}
      </span>
      <Button size="sm" onClick={onToggleAll} disabled={total === 0}>
        {all ? t('ui.sel.none') : t('ui.sel.all')}
      </Button>
      <Button size="sm" variant="danger" icon="trash" disabled={!selected} onClick={onDelete}>
        {t('cred.delete')}
      </Button>
    </div>
  );
}
