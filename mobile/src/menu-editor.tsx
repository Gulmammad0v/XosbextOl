import { useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { MenuItemTemplate, MenuPackage } from './types';
import { Button, Field, s } from './ui';
import { colors } from './theme';

type PriceMode = 'category' | 'custom' | 'fixed';

type DraftItem = {
  key: number;
  name: string;
  price: number;
  priceMode: PriceMode;
  seasonal: boolean;
  selected: boolean;
  template: boolean;
};

type DraftCategory = {
  key: number;
  name: string;
  items: DraftItem[];
  template: boolean;
  customizable: boolean;
  price: number;
  expanded: boolean;
};

type ItemSheetDraft = {
  categoryKey: number;
  itemKey?: number;
  name: string;
  selected: boolean;
  customizable: boolean;
  price: number;
  template: boolean;
};

let nextKey = 1;
const normalized = (value: string) => value.trim().toLocaleLowerCase('az');
const money = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',');

function commonPrice(items: { customizable: boolean; additionalPricePerPerson: number }[]) {
  const frequencies = new Map<number, number>();
  items.filter(item => item.customizable && Number(item.additionalPricePerPerson) > 0).forEach(item => {
    const price = Number(item.additionalPricePerPerson);
    frequencies.set(price, (frequencies.get(price) || 0) + 1);
  });
  return [...frequencies].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 2;
}

function initialCategories(menu: MenuPackage | undefined, templates: MenuItemTemplate[], creationMode: 'standard' | 'empty', newCategoryName: string): DraftCategory[] {
  const orderedTemplates = [...templates].sort((a, b) => a.categorySortOrder - b.categorySortOrder || a.itemSortOrder - b.itemSortOrder);
  const grouped = new Map<string, MenuItemTemplate[]>();
  orderedTemplates.forEach(template => {
    const values = grouped.get(template.categoryName) || [];
    values.push(template);
    grouped.set(template.categoryName, values);
  });

  const result: DraftCategory[] = [];
  grouped.forEach((categoryTemplates, categoryName) => {
    const existingCategory = menu?.categories.find(category => normalized(category.name) === normalized(categoryName));
    const existingItems = existingCategory?.items || [];
    const hasStoredCategoryRule = existingCategory?.defaultCustomizable !== undefined && existingCategory?.defaultCustomizable !== null
      && existingCategory?.defaultPricePerPerson !== undefined && existingCategory?.defaultPricePerPerson !== null;
    const categoryPrice = hasStoredCategoryRule ? Number(existingCategory.defaultPricePerPerson) : commonPrice(existingItems);
    const categoryCustomizable = menu ? existingCategory?.defaultCustomizable ?? existingItems.some(item => item.customizable) : true;
    const hasIndividualRules = existingItems.some(item => item.customizable);
    const templateNames = new Set(categoryTemplates.map(template => normalized(template.itemName)));
    const items: DraftItem[] = !menu && creationMode === 'empty' ? [] : categoryTemplates.map(template => {
      const existing = existingItems.find(item => normalized(item.name) === normalized(template.itemName));
      const existingPrice = Number(existing?.additionalPricePerPerson ?? categoryPrice);
      const matchesCategoryRule = !!existing && existing.customizable === categoryCustomizable
        && (!categoryCustomizable || existingPrice === categoryPrice);
      const priceMode: PriceMode = !existing || (hasStoredCategoryRule && matchesCategoryRule) || (!hasStoredCategoryRule && !hasIndividualRules && !existing.customizable)
        ? 'category'
        : !existing.customizable ? 'fixed' : 'custom';
      return {
        key: nextKey++,
        name: template.itemName,
        price: existingPrice,
        priceMode,
        seasonal: existing?.seasonal ?? template.seasonal,
        selected: menu ? !!existing : true,
        template: true,
      };
    });
    existingItems.filter(item => !templateNames.has(normalized(item.name))).forEach(item => items.push({
      key: nextKey++,
      name: item.name,
      price: Number(item.additionalPricePerPerson || categoryPrice),
      priceMode: hasStoredCategoryRule && item.customizable === categoryCustomizable && (!categoryCustomizable || Number(item.additionalPricePerPerson) === categoryPrice)
        ? 'category'
        : !item.customizable ? 'fixed' : Number(item.additionalPricePerPerson) === categoryPrice ? 'category' : 'custom',
      seasonal: item.seasonal,
      selected: true,
      template: false,
    }));
    result.push({
      key: nextKey++,
      name: categoryName,
      items,
      template: true,
      customizable: categoryCustomizable,
      price: categoryPrice,
      expanded: result.length === 0,
    });
  });

  const templateCategories = new Set([...grouped.keys()].map(normalized));
  menu?.categories.filter(category => !templateCategories.has(normalized(category.name))).forEach(category => {
    const hasStoredCategoryRule = category.defaultCustomizable !== undefined && category.defaultCustomizable !== null
      && category.defaultPricePerPerson !== undefined && category.defaultPricePerPerson !== null;
    const categoryPrice = hasStoredCategoryRule ? Number(category.defaultPricePerPerson) : commonPrice(category.items);
    const categoryCustomizable = category.defaultCustomizable ?? category.items.some(item => item.customizable);
    const hasIndividualRules = category.items.some(item => item.customizable);
    result.push({
      key: nextKey++,
      name: category.name,
      template: false,
      customizable: categoryCustomizable,
      price: categoryPrice,
      expanded: result.length === 0,
      items: category.items.map(item => ({
        key: nextKey++,
        name: item.name,
        price: Number(item.additionalPricePerPerson || categoryPrice),
        priceMode: hasStoredCategoryRule && item.customizable === categoryCustomizable && (!categoryCustomizable || Number(item.additionalPricePerPerson) === categoryPrice)
          ? 'category'
          : !hasIndividualRules && !item.customizable
          ? 'category'
          : !item.customizable ? 'fixed' : Number(item.additionalPricePerPerson) === categoryPrice ? 'category' : 'custom',
        seasonal: item.seasonal,
        selected: true,
        template: false,
      })),
    });
  });

  if (result.length) return result;
  return [{ key: nextKey++, name: newCategoryName, items: [], template: false, customizable: true, price: 2, expanded: true }];
}

function itemRule(item: DraftItem, category: DraftCategory) {
  if (item.priceMode === 'category') return { customizable: category.customizable, price: category.price };
  if (item.priceMode === 'custom') return { customizable: true, price: item.price };
  return { customizable: false, price: 0 };
}

export type MenuEditorPayload = {
  name: string;
  description: string | null;
  pricePerPerson: number;
  tier: number;
  popular: boolean;
  active: boolean;
  categories: { name: string; sortOrder: number; defaultCustomizable: boolean; defaultPricePerPerson: number; items: { name: string; description: string | null; seasonal: boolean; customizable: boolean; additionalPricePerPerson: number }[] }[];
};

export function MenuEditor({ menu, templates, defaultTier, creationMode = 'standard', busy, onSave }: {
  menu?: MenuPackage;
  templates: MenuItemTemplate[];
  defaultTier: number;
  creationMode?: 'standard' | 'empty';
  busy?: boolean;
  onSave: (payload: MenuEditorPayload) => void;
}) {
  const { t } = useTranslation();
  const newCategoryName = t('menuEditor.newCategory');
  const [name, setName] = useState(menu?.name || (creationMode === 'standard' && defaultTier === 1 ? t('menuEditor.defaultStandardName') : t('menuEditor.defaultName', { tier: defaultTier })));
  const [basePrice, setBasePrice] = useState(String(menu?.pricePerPerson ?? 0));
  const [categories, setCategories] = useState<DraftCategory[]>(() => initialCategories(menu, templates, creationMode, newCategoryName));
  const [itemSheet, setItemSheet] = useState<ItemSheetDraft>();

  const updateCategory = (key: number, change: Partial<DraftCategory>) => setCategories(values => values.map(value => value.key === key ? { ...value, ...change } : value));
  const updateItem = (categoryKey: number, itemKey: number, change: Partial<DraftItem>) => setCategories(values => values.map(category => category.key === categoryKey
    ? { ...category, items: category.items.map(item => item.key === itemKey ? { ...item, ...change } : item) }
    : category));

  const openItem = (category: DraftCategory, item?: DraftItem) => {
    const rule = item ? itemRule(item, category) : { customizable: true, price: 2 };
    setItemSheet({
      categoryKey: category.key,
      itemKey: item?.key,
      name: item?.name || '',
      selected: item?.selected ?? true,
      customizable: rule.customizable,
      price: rule.customizable ? rule.price : 2,
      template: item?.template ?? false,
    });
  };

  const closeItemSheet = () => {
    Keyboard.dismiss();
    setItemSheet(undefined);
  };

  const saveItem = () => {
    if (!itemSheet) return;
    if (!itemSheet.name.trim()) {
      Alert.alert(t('common.checkDetails'), t('menuEditor.validation.itemName'));
      return;
    }
    const category = categories.find(value => value.key === itemSheet.categoryKey);
    if (!category) return;
    const priceMode: PriceMode = itemSheet.customizable ? 'custom' : 'fixed';
    if (itemSheet.itemKey) {
      updateItem(category.key, itemSheet.itemKey, {
        name: itemSheet.name.trim(),
        selected: itemSheet.selected,
        price: itemSheet.price,
        priceMode,
      });
    } else {
      updateCategory(category.key, {
        items: [...category.items, {
          key: nextKey++,
          name: itemSheet.name.trim(),
          price: itemSheet.price,
          priceMode,
          seasonal: false,
          selected: itemSheet.selected,
          template: false,
        }],
      });
    }
    closeItemSheet();
  };

  const deleteItem = () => {
    if (!itemSheet?.itemKey || itemSheet.template) return;
    const category = categories.find(value => value.key === itemSheet.categoryKey);
    if (!category) return;
    Alert.alert(t('menuEditor.deleteItem'), t('menuEditor.deleteItemMessage', { name: itemSheet.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => {
        updateCategory(category.key, { items: category.items.filter(item => item.key !== itemSheet.itemKey) });
        closeItemSheet();
      } },
    ]);
  };

  const validationMessage = () => {
    if (!name.trim()) return t('menuEditor.validation.menuName');
    if (!basePrice.trim() || !Number.isFinite(Number(basePrice)) || Number(basePrice) < 0) return t('menuEditor.validation.price');
    const selected = categories.flatMap(category => category.items.filter(item => item.selected));
    if (!selected.length) return t('menuEditor.validation.selection');
    if (categories.some(category => category.items.some(item => item.selected) && !category.name.trim())) return t('menuEditor.validation.categoryName');
    if (selected.some(item => !item.name.trim())) return t('menuEditor.validation.selectedItemNames');
    return undefined;
  };

  const submit = () => {
    const error = validationMessage();
    if (error) {
      Alert.alert(t('common.checkDetails'), error);
      return;
    }
    onSave({
      name: name.trim(),
      description: menu?.description || (creationMode === 'standard' ? t('menuEditor.standardDescription') : null),
      pricePerPerson: Number(basePrice),
      tier: menu?.tier ?? defaultTier,
      popular: menu?.popular ?? false,
      active: true,
      categories: categories.map((category, index) => ({
        name: category.name.trim(),
        sortOrder: index + 1,
        defaultCustomizable: category.customizable,
        defaultPricePerPerson: category.price,
        items: category.items.filter(item => item.selected).map(item => {
          const rule = itemRule(item, category);
          return {
            name: item.name.trim(),
            description: null,
            seasonal: item.seasonal,
            customizable: rule.customizable,
            additionalPricePerPerson: rule.customizable ? rule.price : 0,
          };
        }),
      })).filter(category => category.items.length > 0),
    });
  };

  const selectedCategory = itemSheet ? categories.find(category => category.key === itemSheet.categoryKey) : undefined;
  const previewPrice = Math.max(0, Number(basePrice) || 0);
  const previewDifference = itemSheet?.customizable ? itemSheet.price : 0;

  return <View style={styles.container}>
    <View style={styles.menuFields}>
      <View style={styles.menuField}><Field label={t('menuEditor.menuName')} value={name} onChangeText={setName} maxLength={120}/></View>
      <View style={styles.menuField}><Field label={t('menuEditor.pricePerPerson')} value={basePrice} onChangeText={setBasePrice} keyboardType="decimal-pad"/></View>
    </View>

    <View style={styles.infoBox}>
      <Ionicons name="information-circle-outline" size={17} color={colors.brand}/>
      <Text style={styles.infoText}>{t('menuEditor.priceInfo')}</Text>
    </View>

    {categories.map(category => {
      const included = category.items.filter(item => item.selected).length;
      const removable = category.items.filter(item => item.selected && itemRule(item, category).customizable).length;
      const summary = removable ? t('menuEditor.removableSummary', { included, total: category.items.length, removable }) : t('menuEditor.fixedSummary', { included, total: category.items.length });
      return <View key={category.key} style={styles.category}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: category.expanded }}
          onPress={() => updateCategory(category.key, { expanded: !category.expanded })}
          style={styles.categoryHeader}
        >
          {category.template
            ? <Text style={styles.categoryTitle} numberOfLines={1}>{category.name}</Text>
            : <TextInput
                style={styles.categoryNameInput}
                value={category.name}
                onChangeText={value => updateCategory(category.key, { name: value })}
                onPressIn={event => event.stopPropagation()}
                maxLength={120}
                selectTextOnFocus={category.name === newCategoryName}
              />}
          <Text style={styles.categorySummary}>{category.expanded ? `${included} / ${category.items.length}` : summary}</Text>
          <Ionicons name={category.expanded ? 'chevron-up' : 'chevron-forward'} size={15} color={colors.muted}/>
        </Pressable>

        {category.expanded && <>
          <View style={styles.itemList}>
            {category.items.map(item => {
              const rule = itemRule(item, category);
              return <Pressable key={item.key} onPress={() => openItem(category, item)} style={({ pressed }) => [styles.itemRow, pressed && styles.pressed]}>
                <Toggle
                  value={item.selected}
                  label={t('menuEditor.itemIncludedLabel', { name: item.name })}
                  onChange={selected => updateItem(category.key, item.key, { selected })}
                />
                <View style={styles.itemNameWrap}>
                  <Text numberOfLines={1} style={[styles.itemName, !item.selected && styles.itemDisabled]}>{item.name || t('menuEditor.newItem')}</Text>
                  {!item.template && <Text style={styles.ownBadge}>{t('menuEditor.customBadge')}</Text>}
                </View>
                {!item.selected
                  ? <Text style={styles.notIncluded}>{t('menuEditor.notIncluded')}</Text>
                  : rule.customizable
                    ? <View style={styles.priceBadge}><Text style={styles.priceBadgeText}>−{money(rule.price)} ₼</Text></View>
                    : <Text style={styles.fixedText}>{t('menuEditor.fixed')}</Text>}
                <Ionicons name="chevron-forward" size={15} color={colors.muted}/>
              </Pressable>;
            })}
          </View>

          <Pressable onPress={() => openItem(category)} style={({ pressed }) => [styles.addItem, pressed && styles.pressed]}>
            <Text style={styles.addItemText}>{t('menuEditor.addItem')}</Text>
          </Pressable>
        </>}
      </View>;
    })}

    <Pressable
      onPress={() => setCategories(values => [
        ...values.map(value => ({ ...value, expanded: false })),
        { key: nextKey++, name: newCategoryName, items: [], template: false, customizable: true, price: 2, expanded: true },
      ])}
      style={({ pressed }) => [styles.addCategory, pressed && styles.pressed]}
    >
      <Text style={styles.addItemText}>{t('menuEditor.addCategory')}</Text>
    </Pressable>

    <Button title={busy ? t('common.saving') : t('menuEditor.saveMenu')} onPress={submit} disabled={busy}/>

    <Modal visible={!!itemSheet} transparent animationType="slide" statusBarTranslucent onRequestClose={closeItemSheet}>
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.backdrop} onPress={closeItemSheet}/>
        {itemSheet && selectedCategory && <View style={styles.sheet}>
          <View style={styles.grabber}/>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
            <Text style={styles.sheetTitle}>{itemSheet.itemKey ? t('menuEditor.itemSettings') : t('menuEditor.newItem')}</Text>
            <Text style={styles.sheetSubtitle}>{selectedCategory.name}</Text>

            <View style={styles.sheetField}>
              <Text style={s.label}>{t('menuEditor.itemName')}</Text>
              {itemSheet.template
                ? <View style={styles.templateName}><Text style={styles.templateNameText} numberOfLines={1}>{itemSheet.name}</Text><Text style={styles.templateBadge}>{t('menuEditor.templateItem')}</Text></View>
                : <TextInput
                    autoFocus={!itemSheet.itemKey}
                    value={itemSheet.name}
                    onChangeText={value => setItemSheet(current => current ? { ...current, name: value } : current)}
                    placeholder={t('menuEditor.itemNamePlaceholder')}
                    placeholderTextColor="#9F9688"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                    maxLength={160}
                    style={styles.nameInput}
                  />}
            </View>

            <View style={styles.settingRow}><Text style={styles.settingLabel}>{t('menuEditor.included')}</Text><Toggle value={itemSheet.selected} label={t('menuEditor.included')} onChange={selected => setItemSheet(current => current ? { ...current, selected } : current)}/></View>
            <View style={styles.settingRow}><Text style={styles.settingLabel}>{t('menuEditor.customerCanRemove')}</Text><Toggle value={itemSheet.customizable} label={t('menuEditor.customerCanRemove')} onChange={customizable => setItemSheet(current => current ? { ...current, customizable, price: customizable && current.price < 1 ? 2 : current.price } : current)}/></View>

            <View style={[styles.priceArea, !itemSheet.customizable && styles.disabledArea]} pointerEvents={itemSheet.customizable ? 'auto' : 'none'}>
              <Text style={s.label}>{t('menuEditor.changePrice')}</Text>
              <Stepper value={itemSheet.price} onChange={price => setItemSheet(current => current ? { ...current, price } : current)}/>
              <View style={styles.quickPrices}>
                {[1, 3, 5].map(price => <QuickPrice key={price} label={`${price} ₼`} selected={itemSheet.price === price} onPress={() => setItemSheet(current => current ? { ...current, price } : current)}/>) }
              </View>
            </View>

            <View style={styles.preview}>
              <View style={styles.previewRow}><Text style={styles.previewLabel}>{t('menuEditor.ifRemoved')}</Text><Text style={styles.previewValue}>{money(previewPrice)} ₼ → {money(Math.max(0, previewPrice - previewDifference))} ₼ {t('menuEditor.perPersonSuffix')}</Text></View>
              <View style={styles.previewRow}><Text style={styles.previewLabel}>{t('menuEditor.ifAddedFromHigher')}</Text><Text style={styles.previewValue}>+{money(previewDifference)} ₼ {t('menuEditor.perPersonSuffix')}</Text></View>
            </View>

            <Button title={itemSheet.itemKey ? t('common.save') : t('common.add')} onPress={saveItem}/>
            {!!itemSheet.itemKey && !itemSheet.template && <Button title={t('menuEditor.deleteItem')} variant="danger" onPress={deleteItem}/>} 
          </ScrollView>
        </View>}
      </KeyboardAvoidingView>
    </Modal>
  </View>;
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (value: boolean) => void; label: string }) {
  return <Pressable
    accessibilityRole="switch"
    accessibilityLabel={label}
    accessibilityState={{ checked: value }}
    onPress={event => { event.stopPropagation(); onChange(!value); }}
    hitSlop={5}
    style={[styles.toggle, value && styles.toggleOn]}
  ><View style={[styles.toggleKnob, value && styles.toggleKnobOn]}/></Pressable>;
}

function Stepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const { t } = useTranslation();
  return <View style={styles.stepper}>
    <Pressable accessibilityRole="button" accessibilityLabel={t('menuEditor.decreasePrice')} onPress={() => onChange(Math.max(1, value - 1))} style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}><Text style={styles.stepButtonText}>−</Text></Pressable>
    <Text style={styles.stepValue}>{money(value)} ₼</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={t('menuEditor.increasePrice')} onPress={() => onChange(value + 1)} style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}><Text style={styles.stepButtonText}>+</Text></Pressable>
  </View>;
}

function QuickPrice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.quickPrice, selected && styles.quickPriceSelected, pressed && styles.pressed]}><Text style={[styles.quickPriceText, selected && styles.quickPriceTextSelected]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  menuFields: { flexDirection: 'row', gap: 8 },
  menuField: { flex: 1 },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.softGold },
  infoText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 15 },
  category: { overflow: 'hidden', borderWidth: 1, borderColor: colors.line, borderRadius: 15, backgroundColor: colors.paper },
  categoryHeader: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, backgroundColor: '#FBF8F1' },
  categoryTitle: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '800', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  categoryNameInput: { flex: 1, minHeight: 38, color: colors.ink, fontSize: 14, fontWeight: '800', paddingVertical: 0 },
  categorySummary: { color: colors.muted, fontSize: 9 },
  itemList: { backgroundColor: colors.paper },
  itemRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  itemNameWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemName: { flexShrink: 1, color: colors.ink, fontSize: 11 },
  itemDisabled: { color: colors.muted, textDecorationLine: 'line-through' },
  ownBadge: { color: colors.brandDark, backgroundColor: colors.softGold, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2, fontSize: 7, fontWeight: '700' },
  notIncluded: { color: colors.muted, fontSize: 8 },
  fixedText: { color: colors.muted, fontSize: 9 },
  priceBadge: { minWidth: 38, alignItems: 'center', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: colors.softGold },
  priceBadgeText: { color: colors.brandDark, fontSize: 9, fontWeight: '700' },
  addItem: { minHeight: 42, alignItems: 'center', justifyContent: 'center', margin: 10, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.goldLight },
  addCategory: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.goldLight, backgroundColor: colors.paper },
  addItemText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  toggle: { width: 34, height: 22, borderRadius: 12, padding: 2, justifyContent: 'center', backgroundColor: '#D9D0BE' },
  toggleOn: { backgroundColor: colors.brand },
  toggleKnob: { width: 18, height: 18, borderRadius: 10, backgroundColor: colors.paper, shadowColor: '#000', shadowOpacity: .12, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  toggleKnobOn: { alignSelf: 'flex-end' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepButton: { width: 38, height: 38, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  stepButtonText: { color: colors.ink, fontSize: 18, lineHeight: 20 },
  stepValue: { minWidth: 42, color: colors.ink, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  pressed: { opacity: .55 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', inset: 0, backgroundColor: 'rgba(31, 29, 25, .52)' },
  sheet: { maxHeight: '91%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.paper, overflow: 'hidden' },
  grabber: { width: 38, height: 4, borderRadius: 3, alignSelf: 'center', backgroundColor: '#D8CBAF', marginTop: 9 },
  sheetContent: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 24, gap: 9 },
  sheetTitle: { color: colors.ink, fontSize: 20, fontWeight: '700', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  sheetSubtitle: { color: colors.muted, fontSize: 10, marginTop: -8 },
  sheetField: { gap: 5 },
  nameInput: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.goldLight, paddingHorizontal: 12, color: colors.ink, fontSize: 13, backgroundColor: colors.paper },
  templateName: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.softGold },
  templateNameText: { flex: 1, color: colors.muted, fontSize: 13 },
  templateBadge: { color: colors.brandDark, fontSize: 8, fontWeight: '700' },
  settingRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingLabel: { color: colors.ink, fontSize: 12 },
  priceArea: { gap: 8 },
  disabledArea: { opacity: .35 },
  quickPrices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quickPrice: { minHeight: 36, justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 13, backgroundColor: colors.paper },
  quickPriceSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  quickPriceText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  quickPriceTextSelected: { color: colors.paper },
  preview: { gap: 4, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFDF9' },
  previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  previewLabel: { flex: 1, color: colors.muted, fontSize: 10 },
  previewValue: { color: colors.ink, fontSize: 11, fontWeight: '800', textAlign: 'right' },
});
