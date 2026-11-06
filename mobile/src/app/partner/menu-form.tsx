import { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '@/api';
import type { MenuItemTemplate, MenuPackage, VenueDetail } from '@/types';
import { MenuEditor, MenuEditorPayload } from '@/menu-editor';
import { Screen, run } from '@/ui';
import { useTranslation } from 'react-i18next';

export default function MenuForm() {
  const { t } = useTranslation();
  const p = useLocalSearchParams<{ venueId: string; menuId?: string; name?: string; mode?: string }>(); const venueId = Number(p.venueId); const menuId = Number(p.menuId || 0);
  const [menu, setMenu] = useState<MenuPackage>(); const [templates, setTemplates] = useState<MenuItemTemplate[]>([]); const [tier, setTier] = useState(1); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  useEffect(() => { Promise.all([api.partnerVenue(venueId), api.catalog<MenuItemTemplate[]>('menu-items')]).then(([detail, items]: [VenueDetail, MenuItemTemplate[]]) => { setMenu(detail.menus.find(value => value.id === menuId)); setTier(detail.menus.length + 1); setTemplates(items); }).finally(() => setLoading(false)); }, [menuId, venueId]);
  const save = (payload: MenuEditorPayload) => run(async () => { setBusy(true); try { await api.saveMenuPackage(venueId, payload, menuId || undefined); router.back(); } finally { setBusy(false); } }, t('partnerMenus.saved'));
  return <Screen title={menu?.name || t('partnerMenus.newMenu')} subtitle={menu ? t('partnerMenus.editMenu') : p.name} loading={loading}><MenuEditor menu={menu} templates={templates} defaultTier={menu?.tier || tier} creationMode={p.mode === 'empty' ? 'empty' : 'standard'} busy={busy} onSave={save}/></Screen>;
}
