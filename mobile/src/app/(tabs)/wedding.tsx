import { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { api } from '@/api';
import type { Booking } from '@/types';
import { Button, Empty, Field, FormModal, Row, Screen } from '@/ui';
import { colors } from '@/theme';
import { loadWeddingTasks, saveWeddingTasks, weddingTaskStats, type WeddingTask } from '@/wedding-tasks';
import { WeddingMenuSummary } from '@/wedding-menu-summary';
import { formatCurrency, formatDate as localizedDate } from '@/format';
import { getAppLanguage } from '@/i18n';

const activeStatuses = ['PENDING_APPROVAL', 'CONFIRMED'];

function parseDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function daysUntil(value: string) {
  const event = parseDate(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((event.getTime() - today.getTime()) / 86_400_000));
}

function selectWedding(bookings: Booking[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return bookings
    .filter(item => (!item.eventType || item.eventType === 'WEDDING') && activeStatuses.includes(item.status) && parseDate(item.eventDate) >= today)
    .sort((a, b) => parseDate(a.eventDate).getTime() - parseDate(b.eventDate).getTime())[0];
}

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function WeddingScreen() {
  const { t } = useTranslation();
  const language = getAppLanguage();
  const [booking, setBooking] = useState<Booking>();
  const [tasks, setTasks] = useState<WeddingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [childParentId, setChildParentId] = useState<string>();
  const [newChild, setNewChild] = useState('');

  const load = useCallback(async () => {
    const data = await api.bookings();
    const selected = selectWedding(data.content || []);
    setBooking(selected);
    setTasks(selected ? await loadWeddingTasks(selected) : []);
  }, []);

  useFocusEffect(useCallback(() => {
    load().finally(() => setLoading(false));
  }, [load]));

  const refresh = async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  const updateTasks = (next: WeddingTask[]) => {
    setTasks(next);
    if (booking) saveWeddingTasks(booking.id, next).catch(() => {});
  };

  const toggleTask = (taskId: string, childId?: string) => {
    const next = tasks.map(task => {
      if (task.id !== taskId) return task;
      if (!childId) {
        const done = !task.done;
        return { ...task, done, children: task.children.map(child => ({ ...child, done })) };
      }
      const children = task.children.map(child => child.id === childId ? { ...child, done: !child.done } : child);
      return { ...task, done: children.length > 0 && children.every(child => child.done), children };
    });
    updateTasks(next);
  };

  const addTask = () => {
    const title = newTask.trim();
    if (!title) return;
    updateTasks([...tasks, { id: newId(), title, done: false, children: [] }]);
    setNewTask('');
  };

  const addChild = (parentId: string) => {
    const title = newChild.trim();
    if (!title) return;
    updateTasks(tasks.map(task => task.id === parentId
      ? { ...task, done: false, children: [...task.children, { id: newId(), title, done: false }] }
      : task));
    setNewChild('');
    setChildParentId(undefined);
  };

  const deleteTask = (taskId: string, childId?: string) => {
    if (!childId) {
      updateTasks(tasks.filter(task => task.id !== taskId));
      return;
    }
    updateTasks(tasks.map(task => task.id === taskId ? { ...task, children: task.children.filter(child => child.id !== childId) } : task));
  };

  if (!booking) {
    return <Screen loading={loading} refreshing={refreshing} onRefresh={refresh}>
      <Text style={styles.pageTitle}>{t('wedding.title')}</Text>
      <View style={styles.emptyCard}>
        <Empty text={t('wedding.empty')}/>
        <Pressable onPress={() => router.push('/(tabs)')} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{t('wedding.findVenue')}</Text>
        </Pressable>
      </View>
    </Screen>;
  }

  const paidPercent = booking.totalPrice > 0 ? Math.min(100, Math.round(booking.paidAmount / booking.totalPrice * 100)) : 0;
  const invited = Math.min(booking.guestCount, booking.guestCount > 0 ? Math.round(booking.guestCount * .6) : 0);
  const remaining = Math.max(0, booking.totalPrice - booking.paidAmount);
  const taskStats = weddingTaskStats(tasks);

  return <Screen loading={loading} refreshing={refreshing} onRefresh={refresh}>
    <Text style={styles.pageTitle}>{t('wedding.title')}</Text>
    <View style={styles.countdownCard}>
      <Text style={styles.countdownLabel}>{t('wedding.remaining')}</Text>
      <Text style={styles.countdown}><Text style={styles.countdownNumber}>{daysUntil(booking.eventDate)}</Text> {t('wedding.days', { count: daysUntil(booking.eventDate) })}</Text>
      <Text style={styles.countdownMeta}>{localizedDate(parseDate(booking.eventDate), language, { day: 'numeric', month: 'long', year: 'numeric' })} · {[booking.venueName, booking.hallName].filter(Boolean).join(', ')}</Text>
    </View>

    <View style={styles.statsRow}>
      <Pressable accessibilityRole="button" onPress={() => setBudgetOpen(true)} style={({ pressed }) => [styles.statCard, pressed && styles.cardPressed]}>
        <View style={styles.statTitleRow}><Text style={styles.statLabel}>{t('wedding.budget')}</Text><Ionicons name="chevron-forward" size={15} color={colors.muted}/></View>
        <Text style={styles.statValue}>{formatCurrency(booking.totalPrice, language)}</Text>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${paidPercent}%` }]}/></View>
        <Text style={styles.statCaption}>{t('wedding.paidAmount', { amount: formatCurrency(booking.paidAmount, language) })}</Text>
      </Pressable>
      <View style={styles.statCard}>
        <Text style={styles.statLabel}>{t('wedding.guests')}</Text>
        <Text style={styles.statValue}>{t('booking.guest', { count: booking.guestCount })}</Text>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${booking.guestCount ? invited / booking.guestCount * 100 : 0}%` }]}/></View>
        <Text style={styles.statCaption}>{t('wedding.invited', { count: invited })}</Text>
      </View>
    </View>

    <WeddingMenuSummary booking={booking}/>

    <View style={styles.sectionHeading}>
      <Text style={styles.sectionLabel}>{t('wedding.preparationList')}</Text>
      <Text style={styles.sectionCount}>{t('wedding.completed', { done: taskStats.done, total: taskStats.total })}</Text>
    </View>
    <View style={styles.taskList}>
      {tasks.map(task => <View key={task.id}>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: task.done }} onPress={() => toggleTask(task.id)} style={({ pressed }) => [styles.taskRow, pressed && { opacity: .6 }]}>
          <Ionicons name={task.done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={task.done ? colors.success : colors.muted}/>
          <Text style={[styles.taskText, task.done && styles.completedText]}>{task.titleKey ? t(task.titleKey) : task.title}</Text>
        </Pressable>
        {task.children.map(child => <Pressable key={child.id} accessibilityRole="checkbox" accessibilityState={{ checked: child.done }} onPress={() => toggleTask(task.id, child.id)} style={({ pressed }) => [styles.taskRow, styles.childTaskRow, pressed && { opacity: .6 }]}>
          <View style={styles.childLine}/>
          <Ionicons name={child.done ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={child.done ? colors.success : colors.muted}/>
          <Text style={[styles.childTaskText, child.done && styles.completedText]}>{child.title}</Text>
        </Pressable>)}
      </View>)}
      {!tasks.length && <Text style={styles.noTasks}>{t('wedding.noTasks')}</Text>}
    </View>

    <Pressable onPress={() => setManagerOpen(true)} style={({ pressed }) => [styles.outlineButton, pressed && { opacity: .65 }]}>
      <Text style={styles.outlineButtonText}>{t('wedding.manageTasks')}</Text>
    </Pressable>

    <FormModal visible={budgetOpen} title={t('wedding.budgetAndPayment')} onClose={() => setBudgetOpen(false)}>
      <View style={styles.paymentSummary}>
        <Row label={t('wedding.totalAmount')} value={formatCurrency(booking.totalPrice, language)}/>
        <Row label={t('common.paid')} value={formatCurrency(booking.paidAmount, language)}/>
        <View style={styles.paymentDivider}/>
        <Row label={t('wedding.remainingAmount')} value={formatCurrency(remaining, language)}/>
      </View>
      <View style={styles.paidNotice}><Ionicons name="restaurant-outline" size={22} color={colors.success}/><Text style={styles.paidNoticeText}>{t('wedding.payAtVenue')}</Text></View>
    </FormModal>

    <FormModal visible={managerOpen} title={t('wedding.manageTasks')} onClose={() => { setManagerOpen(false); setChildParentId(undefined); setNewChild(''); }}>
      <View style={styles.addTaskBox}>
        <Field label={t('wedding.newTask')} value={newTask} onChangeText={setNewTask} maxLength={80} placeholder={t('wedding.newTaskPlaceholder')} returnKeyType="done" onSubmitEditing={addTask}/>
        <Button title={t('wedding.addTask')} onPress={addTask} disabled={!newTask.trim()}/>
      </View>

      {tasks.map(task => <View key={task.id} style={styles.managerTask}>
        <View style={styles.managerRow}>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: task.done }} onPress={() => toggleTask(task.id)} style={styles.managerCheckbox}>
            <Ionicons name={task.done ? 'checkmark-circle' : 'ellipse-outline'} size={23} color={task.done ? colors.success : colors.muted}/>
          </Pressable>
          <Text style={[styles.managerTaskText, task.done && styles.completedText]}>{task.titleKey ? t(task.titleKey) : task.title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('wedding.addSubtask')} onPress={() => { setChildParentId(task.id); setNewChild(''); }} style={styles.iconButton}>
            <Ionicons name="add-circle-outline" size={22} color={colors.brandDark}/>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('wedding.deleteTask')} onPress={() => deleteTask(task.id)} style={styles.iconButton}>
            <Ionicons name="trash-outline" size={20} color={colors.danger}/>
          </Pressable>
        </View>

        {task.children.map(child => <View key={child.id} style={styles.managerChildRow}>
          <Ionicons name="return-down-forward-outline" size={17} color={colors.muted}/>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: child.done }} onPress={() => toggleTask(task.id, child.id)}>
            <Ionicons name={child.done ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={child.done ? colors.success : colors.muted}/>
          </Pressable>
          <Text style={[styles.managerChildText, child.done && styles.completedText]}>{child.title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('wedding.deleteSubtask')} onPress={() => deleteTask(task.id, child.id)} style={styles.iconButton}>
            <Ionicons name="trash-outline" size={18} color={colors.danger}/>
          </Pressable>
        </View>)}

        {childParentId === task.id && <View style={styles.childComposer}>
          <Field label={t('wedding.subtask')} value={newChild} onChangeText={setNewChild} maxLength={80} placeholder={t('wedding.subtaskPlaceholder')} returnKeyType="done" onSubmitEditing={() => addChild(task.id)}/>
          <View style={styles.composerActions}>
            <Button title={t('common.cancel')} compact variant="ghost" onPress={() => { setChildParentId(undefined); setNewChild(''); }}/>
            <Button title={t('wedding.add')} compact onPress={() => addChild(task.id)} disabled={!newChild.trim()}/>
          </View>
        </View>}
      </View>)}
    </FormModal>
  </Screen>;
}

const styles = StyleSheet.create({
  pageTitle: { color: colors.ink, fontSize: 25, lineHeight: 32, fontWeight: '700', textAlign: 'center', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  countdownCard: { minHeight: 124, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2E2C29', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 17 },
  countdownLabel: { color: '#EED69A', fontSize: 11, fontWeight: '700', letterSpacing: .5 },
  countdown: { color: '#E7C778', fontSize: 24, lineHeight: 49, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  countdownNumber: { fontSize: 49 },
  countdownMeta: { color: '#F5EBD2', fontSize: 12, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, minHeight: 98, backgroundColor: colors.paper, borderRadius: 16, padding: 13, borderWidth: 1, borderColor: '#F0EAE0' },
  cardPressed: { opacity: .68, borderColor: colors.gold },
  statTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statLabel: { color: colors.muted, fontSize: 11 },
  statValue: { color: colors.ink, fontSize: 18, lineHeight: 26, fontWeight: '800' },
  progressTrack: { height: 6, overflow: 'hidden', borderRadius: 5, backgroundColor: '#EEE8DC', marginTop: 2 },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: colors.gold },
  statCaption: { color: colors.muted, fontSize: 10, marginTop: 7 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 1, paddingHorizontal: 4 },
  sectionLabel: { color: colors.brandDark, fontSize: 10, letterSpacing: 1.1, fontWeight: '800' },
  sectionCount: { color: colors.muted, fontSize: 10 },
  taskList: { overflow: 'hidden', backgroundColor: colors.paper, borderRadius: 16, borderWidth: 1, borderColor: '#F0EAE0' },
  taskRow: { minHeight: 47, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  childTaskRow: { minHeight: 42, paddingLeft: 31, backgroundColor: '#FCF9F3' },
  childLine: { width: 9, height: 14, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: colors.goldLight, marginTop: -8 },
  taskText: { flex: 1, color: colors.ink, fontSize: 14 },
  childTaskText: { flex: 1, color: colors.ink, fontSize: 13 },
  completedText: { color: colors.muted, textDecorationLine: 'line-through' },
  noTasks: { color: colors.muted, textAlign: 'center', padding: 25 },
  outlineButton: { minHeight: 45, alignItems: 'center', justifyContent: 'center', borderRadius: 24, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.paper },
  outlineButtonText: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  paymentSummary: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 15, gap: 8 },
  paymentDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  paidNotice: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EDF4EE', borderRadius: 16 },
  paidNoticeText: { color: colors.success, fontWeight: '800' },
  addTaskBox: { gap: 11, backgroundColor: colors.softGold, borderRadius: 17, padding: 14 },
  managerTask: { overflow: 'hidden', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 16 },
  managerRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  managerCheckbox: { paddingVertical: 8 },
  managerTaskText: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '600' },
  managerChildRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 19, paddingRight: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: '#FCF9F3' },
  managerChildText: { flex: 1, color: colors.ink, fontSize: 13 },
  iconButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  childComposer: { gap: 10, padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.softGold },
  composerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  emptyCard: { backgroundColor: colors.paper, borderRadius: 18, padding: 17, borderWidth: 1, borderColor: colors.line },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.brand },
  primaryButtonText: { color: colors.paper, fontWeight: '800' }
});
