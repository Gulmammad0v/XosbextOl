import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { Amenity } from './types';
import { colors } from './theme';
import { getAppLanguage } from './i18n';

const label = (amenity: Amenity) => {
  const language = getAppLanguage();
  if (language === 'en') return amenity.nameEn || amenity.name_en || amenity.nameAz || amenity.name_az || amenity.name || amenity.code || String(amenity.id);
  if (language === 'ru') return amenity.nameRu || amenity.name_ru || amenity.nameAz || amenity.name_az || amenity.name || amenity.code || String(amenity.id);
  return amenity.nameAz || amenity.name_az || amenity.name || amenity.code || String(amenity.id);
};
const normalized = (value: string) => value.trim().toLocaleLowerCase('az');
const isCustom = (amenity: Amenity) => amenity.code?.startsWith('CUSTOM_');

export function AmenityEditor({ catalog, selectedIds, onSelectedIdsChange, customNames, onCustomNamesChange }: {
  catalog: Amenity[];
  selectedIds: number[];
  onSelectedIdsChange: (ids: number[]) => void;
  customNames: string[];
  onCustomNamesChange: (names: string[]) => void;
}) {
  const { t } = useTranslation();
  const [newName, setNewName] = useState('');
  const standardAmenities = useMemo(() => catalog.filter(item => !isCustom(item)), [catalog]);
  const selectedCustomAmenities = useMemo(() => catalog.filter(item => isCustom(item) && selectedIds.includes(item.id)), [catalog, selectedIds]);
  const selectedCount = selectedIds.length + customNames.length;

  const toggle = (id: number) => onSelectedIdsChange(selectedIds.includes(id) ? selectedIds.filter(value => value !== id) : [...selectedIds, id]);
  const add = () => {
    const name = newName.trim();
    if (!name) return;
    const existing = catalog.find(item => normalized(label(item)) === normalized(name));
    if (existing) {
      if (!selectedIds.includes(existing.id)) onSelectedIdsChange([...selectedIds, existing.id]);
    } else if (!customNames.some(item => normalized(item) === normalized(name))) {
      onCustomNamesChange([...customNames, name]);
    }
    setNewName('');
  };

  return <>
    <View style={styles.introRow}>
      <Text style={styles.intro}>{t('amenityEditor.intro')}</Text>
      <Text style={styles.count}>{t('amenityEditor.selected', { count: selectedCount })}</Text>
    </View>

    <View style={styles.card}>
      <View style={styles.chips}>
        {standardAmenities.map(item => {
          const selected = selectedIds.includes(item.id);
          return <Pressable key={item.id} onPress={() => toggle(item.id)} style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
            {selected && <Ionicons name="checkmark" size={14} color="#fff"/>}
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label(item)}</Text>
          </Pressable>;
        })}
      </View>
    </View>

    <Text style={styles.sectionLabel}>{t('amenityEditor.customSection')}</Text>
    <View style={styles.card}>
      {(selectedCustomAmenities.length > 0 || customNames.length > 0) && <View style={styles.customChips}>
        {selectedCustomAmenities.map(item => <Pressable key={item.id} onPress={() => toggle(item.id)} style={styles.customChip}>
          <Text style={styles.customChipText}>{label(item)} ×</Text>
        </Pressable>)}
        {customNames.map(name => <Pressable key={normalized(name)} onPress={() => onCustomNamesChange(customNames.filter(item => item !== name))} style={styles.customChip}>
          <Text style={styles.customChipText}>{name} ×</Text>
        </Pressable>)}
      </View>}
      <View style={styles.addRow}>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          onSubmitEditing={add}
          maxLength={100}
          returnKeyType="done"
          placeholder={t('amenityEditor.placeholder')}
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Pressable onPress={add} disabled={!newName.trim()} style={({ pressed }) => [styles.addButton, (!newName.trim() || pressed) && styles.disabled]}>
          <Text style={styles.addButtonText}>{t('common.add')}</Text>
        </Pressable>
      </View>
    </View>
    <Text style={styles.hint}>{t('amenityEditor.hint')}</Text>
  </>;
}

const styles = StyleSheet.create({
  introRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 3 },
  intro: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 18 },
  count: { color: colors.brandDark, fontSize: 11, fontWeight: '800' },
  sectionLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: .8, marginTop: 6, marginLeft: 4 },
  card: { padding: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  chipSelected: { borderColor: colors.brand, backgroundColor: colors.brand },
  chipText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  chipTextSelected: { color: '#fff' },
  customChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 11 },
  customChip: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: colors.gold, backgroundColor: '#FFF9EC' },
  customChipText: { color: colors.brandDark, fontSize: 11, fontWeight: '600' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, height: 47, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: colors.line, color: colors.ink, backgroundColor: colors.paper, fontSize: 13 },
  addButton: { height: 47, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 24, backgroundColor: '#E8DFC9' },
  addButtonText: { color: colors.brandDark, fontSize: 11, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: 9, lineHeight: 14, textAlign: 'center' },
  pressed: { opacity: .7 },
  disabled: { opacity: .48 },
});
