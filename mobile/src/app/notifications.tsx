import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api } from '@/api';
import type { Notification } from '@/types';
import { Button, Card, Empty, FormModal, Screen, confirm, s, run } from '@/ui';
import { colors } from '@/theme';
import { useNotificationState } from '@/notification-state';
import { useAuth } from '@/auth';
import { useTranslation } from 'react-i18next';
import { appLocale } from '@/format';
import { getAppLanguage } from '@/i18n';

export default function Notifications() {
  const { t } = useTranslation();
  const language = getAppLanguage();
  const { user } = useAuth();
  const { refreshUnread } = useNotificationState();
  const [items, setItems] = useState<Notification[]>([]); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false);
  const [selecting, setSelecting] = useState(false); const [selected, setSelected] = useState<number[]>([]);
  const [opened, setOpened] = useState<Notification>();
  const load = async () => { const data = await api.notifications(); setItems(data.content || []); };
  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);
  const refresh = async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } };
  const hasUnread = items.some(item => !(item.read ?? item.is_read ?? item.isRead ?? false));
  const readAll = () => run(async () => { await api.readAllNotifications(); await Promise.all([load(), refreshUnread()]); });
  const openNotification = (item: Notification) => run(async () => {
    const read = item.read ?? item.is_read ?? item.isRead ?? false;
    if (!read) await api.readNotification(item.id);
    const viewed = { ...item, read: true, is_read: true, isRead: true };
    setItems(current => current.map(value => value.id === item.id ? viewed : value));
    await refreshUnread();
    const deepLink = item.deepLink || item.actionPath;
    if (deepLink) {
      router.push(deepLink as any);
      return;
    }
    setOpened(viewed);
  });
  const toggle = (id: number) => setSelected(value => value.includes(id) ? value.filter(item => item !== id) : [...value, id]);
  const stopSelecting = () => { setSelecting(false); setSelected([]); };
  const unreadCount = items.filter(item => !(item.read ?? item.is_read ?? item.isRead ?? false)).length;
  const removeSelected = () => confirm(t('notifications.deleteTitle'), t('notifications.deleteMessage', { count: selected.length }), () => run(async () => { await api.deleteNotifications(selected); stopSelecting(); await Promise.all([load(), refreshUnread()]); }, t('notifications.deleted')));
  const action = items.length ? <Button title={selecting ? t('common.cancel') : t('notifications.select')} compact variant="secondary" onPress={() => selecting ? stopSelecting() : setSelecting(true)}/> : undefined;
  return <Screen title={selecting ? t('notifications.selected', { count: selected.length }) : t('notifications.title')} subtitle={selecting ? t('notifications.title') : unreadCount ? t('notifications.unread', { count: unreadCount }) : t('notifications.allRead')} loading={loading} refreshing={refreshing} onRefresh={refresh} action={action} partnerNav={user?.role === 'VENUE_OWNER' && !selecting} back>
    {selecting && <View style={s.titleRow}><Button title={selected.length === items.length ? t('notifications.clearSelection') : t('notifications.selectAll')} compact variant="ghost" onPress={() => setSelected(selected.length === items.length ? [] : items.map(item => item.id))}/></View>}
    {!selecting && hasUnread && <Button title={t('notifications.markAllRead')} compact variant="secondary" onPress={readAll}/>} 
    {!items.length ? <Empty text={t('notifications.empty')}/> : items.map(item => { const read = item.read ?? item.is_read ?? item.isRead ?? false; const checked = selected.includes(item.id); return <Card key={item.id} onPress={selecting ? () => toggle(item.id) : () => openNotification(item)} style={[!read ? { backgroundColor: '#FCF8EC' } : {}, checked ? { backgroundColor: colors.softGold, borderColor: colors.gold } : {}]}><View style={s.titleRow}>{selecting && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={event => { event.stopPropagation(); toggle(item.id); }}><Ionicons name={checked ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={checked ? colors.brandDark : colors.gold}/></Pressable>}<Text style={[s.h2, { flex: 1 }]}>{item.title}</Text>{!!(item.createdAt || item.created_at) && <Text style={s.muted}>{relativeTime(item.createdAt || item.created_at || '', t)}</Text>}</View><Text numberOfLines={2} style={s.muted}>{item.body}</Text></Card>; })}
    {selecting && <View style={s.actions}><Button title={t('notifications.clearSelection')} variant="secondary" onPress={() => setSelected([])}/><Button title={t('notifications.deleteCount', { count: selected.length })} variant="danger" disabled={!selected.length} onPress={removeSelected}/></View>}
    <FormModal visible={!!opened} title={opened?.title || t('notifications.single')} onClose={() => setOpened(undefined)}>
      <Text style={s.body}>{opened?.body}</Text>
      {!!(opened?.createdAt || opened?.created_at) && <Text style={s.muted}>{new Date(opened.createdAt || opened.created_at || '').toLocaleString(appLocale(language))}</Text>}
      {opened?.type === 'REVIEW_REQUEST' && opened.actionPath && <Button title={t('venueDetails.writeReview')} onPress={() => { const path = opened.actionPath; setOpened(undefined); router.push(path as any); }}/>} 
    </FormModal>
  </Screen>;
}

function relativeTime(value: string, t: (key: string, options?: Record<string, unknown>) => string) {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000));
  if (hours < 1) return t('notifications.now');
  if (hours < 24) return t('notifications.hoursAgo', { count: hours });
  if (hours < 48) return t('notifications.yesterday');
  return t('notifications.daysAgo', { count: Math.floor(hours / 24) });
}
