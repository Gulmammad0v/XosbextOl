import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { Booking } from './types';
import { colors } from './theme';
import { Badge, Card, FormModal, Money, Row, s } from './ui';
import { formatCurrency } from './format';
import { getAppLanguage } from './i18n';

export function WeddingMenuSummary({ booking }: { booking: Booking }) {
  const { t } = useTranslation();
  const language = getAppLanguage();
  const [open, setOpen] = useState(false);
  const categories = booking.menuCategories || [];
  const itemCount = categories.reduce((total, category) => total + category.items.length, 0);
  const changes = booking.menuChanges || [];
  const addedChanges = changes.filter(change => change.action === 'ADDED');
  const removedChanges = changes.filter(change => change.action === 'REMOVED');
  const addedPrices = new Map(addedChanges.map(change => [change.itemId, Number(change.pricePerPerson)]));
  const basePerPerson = booking.guestCount > 0 ? Number(booking.hallPrice) / booking.guestCount : 0;
  const additionsPerPerson = addedChanges.reduce((total, change) => total + Number(change.pricePerPerson), 0);
  const deductionsPerPerson = removedChanges.reduce((total, change) => total + Number(change.pricePerPerson), 0);

  return <>
    <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={({ pressed }) => [styles.summaryCard, pressed && styles.cardPressed]}>
      <View style={styles.iconBox}><Ionicons name="restaurant-outline" size={21} color={colors.brandDark}/></View>
      <View style={styles.summaryText}>
        <Text style={styles.statLabel}>{t('common.menu')}</Text>
        <Text numberOfLines={1} style={styles.statValue}>{booking.menuName || t('common.notSelected')}</Text>
        <Text style={styles.statCaption}>{t('weddingMenu.summary', { count: itemCount || booking.addedMenuItems?.length || 0 })}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted}/>
    </Pressable>

    <FormModal visible={open} title={t('weddingMenu.selectedMenu')} onClose={() => setOpen(false)}>
      <Card>
        <View style={s.titleRow}>
          <View style={{ flex: 1 }}><Text style={s.h1}>{booking.menuName || t('common.menu')}</Text><Text style={s.muted}>{t('weddingMenu.forGuests', { count: booking.guestCount })}</Text></View>
          <Badge value={t('weddingMenu.items', { count: itemCount })}/>
        </View>
        <Row label={t('weddingMenu.basePrice')} value={<Money value={basePerPerson}/>}/>
        {additionsPerPerson > 0 ? <Row label={t('weddingMenu.additions')} value={<Text style={styles.additionPrice}>+{formatCurrency(additionsPerPerson, language)}</Text>}/> : null}
        {deductionsPerPerson > 0 ? <Row label={t('weddingMenu.removals')} value={<Text style={styles.deductionPrice}>−{formatCurrency(deductionsPerPerson, language)}</Text>}/> : null}
        <Row label={t('weddingMenu.perPerson')} value={<Money value={basePerPerson + additionsPerPerson - deductionsPerPerson}/>}/>
      </Card>

      {categories.map(category => <View key={category.id} style={styles.category}>
        <View style={styles.categoryHeader}><Text style={styles.categoryTitle}>{category.name}</Text><Text style={styles.categoryCount}>{t('weddingMenu.selections', { count: category.items.length })}</Text></View>
        {category.items.map(item => <View key={item.id} style={styles.itemRow}>
          <Ionicons name={addedPrices.has(item.id) ? 'add-circle' : 'checkmark-circle'} size={19} color={addedPrices.has(item.id) ? colors.gold : colors.success}/>
          <Text style={styles.itemName}>{item.name}</Text>
          {addedPrices.has(item.id) ? <Text style={styles.addedLabel}>+{t('weddingMenu.pricePerPerson', { price: formatCurrency(addedPrices.get(item.id) || 0, language) })}</Text> : null}
          {item.seasonal ? <Text style={styles.seasonalLabel}>{t('weddingMenu.seasonal')}</Text> : null}
        </View>)}
      </View>)}

      {!categories.length ? <Card><Text style={s.muted}>{t('weddingMenu.noDetails')}</Text></Card> : null}
      {removedChanges.length ? <Card>
        <Text style={s.label}>{t('weddingMenu.removedItems')}</Text>
        {removedChanges.map(change => <View key={change.itemId} style={styles.removedRow}><Text style={s.muted}>{change.name}</Text><Text style={styles.deductionPrice}>−{t('weddingMenu.pricePerPerson', { price: formatCurrency(change.pricePerPerson, language) })}</Text></View>)}
      </Card> : null}
    </FormModal>
  </>;
}

const styles = StyleSheet.create({
  summaryCard: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.paper, borderRadius: 16, padding: 13, borderWidth: 1, borderColor: '#F0EAE0' },
  cardPressed: { opacity: .68, borderColor: colors.gold },
  iconBox: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.softGold },
  summaryText: { flex: 1 },
  statLabel: { color: colors.muted, fontSize: 11 },
  statValue: { color: colors.ink, fontSize: 17, lineHeight: 24, fontWeight: '800' },
  statCaption: { color: colors.muted, fontSize: 10 },
  category: { overflow: 'hidden', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 16 },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.softGold },
  categoryTitle: { flex: 1, color: colors.ink, fontWeight: '800' },
  categoryCount: { color: colors.brandDark, fontSize: 11, fontWeight: '700' },
  itemRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  itemName: { flex: 1, color: colors.ink, fontSize: 13 },
  addedLabel: { color: colors.brandDark, backgroundColor: colors.softGold, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3, fontSize: 10, fontWeight: '800' },
  seasonalLabel: { color: colors.success, fontSize: 10, fontWeight: '700' },
  removedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  additionPrice: { color: colors.brandDark, fontWeight: '800' },
  deductionPrice: { color: colors.success, fontWeight: '800' },
});
