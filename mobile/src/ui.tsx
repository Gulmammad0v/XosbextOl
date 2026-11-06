import { PropsWithChildren, ReactNode, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { AndroidDensitySuppressed, colors, useAndroidContentScale, useCompactAndroidLayout } from './theme';
import { labels } from './types';
import { PartnerBottomNav, PartnerNavContext } from './partner-nav';
import { useTranslation } from 'react-i18next';
import { getAppLanguage, translate } from './i18n';
import { formatCurrency } from './format';

export function AndroidScaledContent({ children, style, fill = false }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; fill?: boolean }>) {
  const scale = useAndroidContentScale();
  const [width, setWidth] = useState(0);
  const [availableHeight, setAvailableHeight] = useState(0);
  const [naturalHeight, setNaturalHeight] = useState(0);
  if (scale === 1) return <View style={style}>{children}</View>;
  return <View
    onLayout={event => {
      const nextWidth = event.nativeEvent.layout.width;
      if (Math.abs(nextWidth - width) > .5) setWidth(nextWidth);
      if (fill) {
        const nextHeight = event.nativeEvent.layout.height;
        if (Math.abs(nextHeight - availableHeight) > .5) setAvailableHeight(nextHeight);
      }
    }}
    style={[s.scaledOuter, fill && s.scaledFill, !fill && naturalHeight > 0 && { height: naturalHeight * scale }]}
  >
    <View
      onLayout={event => {
        const nextHeight = event.nativeEvent.layout.height;
        if (!fill && Math.abs(nextHeight - naturalHeight) > .5) setNaturalHeight(nextHeight);
      }}
      style={[style, width > 0 && { width: width / scale }, fill && availableHeight > 0 && { height: availableHeight / scale }, s.scaledInner, { transform: [{ scale }] }]}
    >
      <AndroidDensitySuppressed>{children}</AndroidDensitySuppressed>
    </View>
  </View>;
}

export function Screen({ children, title, subtitle, loading, refreshing, onRefresh, action, footer, partnerNav, back, androidDensity = 'auto' }: PropsWithChildren<{ title?: string; subtitle?: string; loading?: boolean; refreshing?: boolean; onRefresh?: () => void; action?: ReactNode; footer?: ReactNode; partnerNav?: PartnerNavContext | boolean; back?: boolean; androidDensity?: 'auto' | 'custom' }>) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const compactLayout = useCompactAndroidLayout();
  if (loading) return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator color={colors.brand} size="large"/><Text style={s.muted}>{t('common.loading')}</Text></View></SafeAreaView>;
  const showBack = back ?? (pathname.startsWith('/partner/') && pathname !== '/partner');
  const navContext = typeof partnerNav === 'object' ? partnerNav : {};
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(pathname.startsWith('/partner') ? '/partner' : '/');
  };
  const content = <>{(title || action) && <View style={s.titleRow}>{showBack && <Pressable accessibilityRole="button" onPress={goBack} style={s.backButton}><Ionicons name="chevron-back" size={21} color={colors.ink}/></Pressable>}<View style={{ flex: 1 }}>{title && <Text style={s.title}>{title}</Text>}{subtitle && <Text style={s.subtitle}>{subtitle}</Text>}</View>{action}</View>}{children}</>;
  return <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} contentContainerStyle={[s.screen, compactLayout && s.screenCompact, partnerNav && s.screenWithNav, !!footer && s.screenWithFooter]} refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.brand}/> : undefined}>
    {compactLayout && androidDensity === 'auto' ? <AndroidScaledContent style={s.scaledScreenContent}>{content}</AndroidScaledContent> : content}
  </ScrollView>{footer && <View style={s.footer}>{footer}</View>}</KeyboardAvoidingView>{partnerNav && <PartnerBottomNav {...navContext}/>}</SafeAreaView>;
}
export function SectionTitle({ children }: PropsWithChildren) { return <Text style={s.sectionTitle}>{children}</Text>; }
export function Card({ children, onPress, style }: PropsWithChildren<{ onPress?: () => void; style?: StyleProp<ViewStyle> }>) {
  const content = <View style={[s.card, style]}>{children}</View>;
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: .76 }}>{content}</Pressable> : content;
}
export function Button({ title, onPress, variant = 'primary', disabled, compact }: { title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; disabled?: boolean; compact?: boolean }) {
  const compactLayout = useCompactAndroidLayout();
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={({ pressed }) => [s.button, s[`button_${variant}`], compact && s.buttonCompact, compactLayout && s.buttonDense, compactLayout && compact && s.buttonCompactDense, (disabled || pressed) && { opacity: .55 }]}><Text style={[s.buttonText, compactLayout && s.buttonTextDense, variant !== 'primary' && s[`buttonText_${variant}`]]}>{title}</Text></Pressable>;
}
export function Field({ label, error, multiline, icon, ...props }: TextInputProps & { label: string; error?: string; icon?: keyof typeof Ionicons.glyphMap }) {
  const compactLayout = useCompactAndroidLayout();
  return <View style={[s.field, compactLayout && s.fieldDense]}><Text style={[s.label, compactLayout && s.labelDense]}>{label}</Text><View style={[s.inputShell, compactLayout && s.inputShellDense, multiline && s.textareaShell, error && { borderColor: colors.danger }]}>{icon && <Ionicons name={icon} size={compactLayout ? 17 : 19} color={colors.brand}/>}<TextInput placeholderTextColor="#9F9688" multiline={multiline} maxFontSizeMultiplier={1.15} style={[s.input, compactLayout && s.inputDense, multiline && s.textarea]} {...props}/></View>{error && <Text style={s.error}>{error}</Text>}</View>;
}
function Choice({ value, label, selected, onPress }: { value: string | number; label: string; selected: boolean; onPress: (value: any) => void }) {
  return <Pressable onPress={() => onPress(value)} style={[s.choice, selected && s.choiceSelected]}><Text style={[s.choiceText, selected && s.choiceTextSelected]}>{label}</Text></Pressable>;
}
export function Chips({ options, value, onChange, multiple }: { options: { value: any; label: string }[]; value: any; onChange: (value: any) => void; multiple?: boolean }) {
  const select = (item: any) => multiple ? onChange((value as any[]).includes(item) ? (value as any[]).filter(v => v !== item) : [...value, item]) : onChange(item);
  return <View style={s.chips}>{options.map(option => <Choice key={String(option.value)} {...option} selected={multiple ? value.includes(option.value) : value === option.value} onPress={select}/>)}</View>;
}
export function Badge({ value }: { value: string }) {
  const { t } = useTranslation();
  return <View style={s.badge}><Text style={s.badgeText}>{t(`labels.${value}`, { defaultValue: labels[value] || value })}</Text></View>;
}
export function Money({ value }: { value: number | string }) {
  useTranslation();
  return <Text style={s.money}>{formatCurrency(value, getAppLanguage())}</Text>;
}
export function MoneyRange({ min, max }: { min: number; max: number }) {
  useTranslation();
  return <Text style={s.money}>{min === max ? formatCurrency(min, getAppLanguage()) : `${formatCurrency(min, getAppLanguage())} – ${formatCurrency(max, getAppLanguage())}`}</Text>;
}
export function Empty({ text }: { text?: string }) {
  const { t } = useTranslation();
  return <View style={s.empty}><Text style={s.emptyIcon}>◇</Text><Text style={s.muted}>{text || t('common.empty')}</Text></View>;
}
export function HeroImage({ uri, compact = false }: { uri?: string; compact?: boolean }) {
  const imageStyle = [s.heroImage, compact && s.heroImageCompact];
  return uri ? <Image source={{ uri }} style={imageStyle}/> : <View style={[imageStyle, s.imagePlaceholder]}><Text style={s.imagePlaceholderText}>XOŞBƏXT OL</Text></View>;
}
export function Row({ label, value }: { label: string; value?: ReactNode }) { return <View style={s.row}><Text style={s.rowLabel}>{label}</Text>{typeof value === 'string' || typeof value === 'number' ? <Text style={s.rowValue}>{value}</Text> : value}</View>; }
export function ErrorText({ error }: { error: unknown }) { return <Text style={s.error}>{error instanceof Error ? error.message : String(error)}</Text>; }

export function FormModal({ visible, title, children, onClose, closeTitle }: PropsWithChildren<{ visible: boolean; title: string; onClose: () => void; closeTitle?: string }>) {
  const { t } = useTranslation();
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><SafeAreaView style={s.safe}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.modal}>
    <AndroidScaledContent style={s.scaledModalContent}><View style={s.titleRow}><Text style={[s.title, { fontSize: 26, flex: 1 }]}>{title}</Text><Button title={closeTitle || t('common.close')} onPress={onClose} variant="ghost" compact/></View>{children}</AndroidScaledContent>
  </ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>;
}
export async function run(action: () => Promise<unknown>, success?: string) {
  try { await action(); if (success) Alert.alert(translate('common.ready'), success); return true; }
  catch (error) { Alert.alert(translate('common.error'), error instanceof Error ? error.message : String(error)); return false; }
}
export function confirm(title: string, message: string, action: () => void) { Alert.alert(title, message, [{ text: translate('common.cancel'), style: 'cancel' }, { text: translate('common.continue'), style: 'destructive', onPress: action }]); }

export const s = StyleSheet.create({
  scaledOuter: { alignSelf: 'stretch', overflow: 'visible' }, scaledFill: { flex: 1 }, scaledInner: { alignSelf: 'flex-start', transformOrigin: 'top left' }, scaledScreenContent: { gap: 12 }, scaledModalContent: { gap: 14 },
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: colors.cream }, screen: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 34, gap: 12 }, screenCompact: { paddingHorizontal: 11, paddingTop: 7, paddingBottom: 26, gap: 9 }, screenWithNav: { paddingBottom: 28 }, screenWithFooter: { paddingBottom: 18 }, footer: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.paper }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  backButton: { width: 40, height: 40, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  ambientRing: { position: 'absolute' }, ambientDot: { position: 'absolute' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, title: { color: colors.ink, fontSize: 24, lineHeight: 29, fontWeight: '700', letterSpacing: -.35, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) }, subtitle: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 1 }, sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '700', marginTop: 10, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  card: { backgroundColor: colors.paper, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: colors.line, gap: 8, shadowColor: colors.shadow, shadowOpacity: .025, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  button: { minHeight: 44, paddingHorizontal: 18, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }, buttonCompact: { minHeight: 38, paddingHorizontal: 14, borderRadius: 20 }, buttonDense: { minHeight: 38, paddingHorizontal: 15 }, buttonCompactDense: { minHeight: 34, paddingHorizontal: 12 }, button_primary: { backgroundColor: colors.brand }, button_secondary: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.goldLight }, button_danger: { backgroundColor: colors.paper, borderWidth: 1, borderColor: '#D8B07A' }, button_ghost: { backgroundColor: 'transparent' },
  buttonText: { color: '#FFFDF8', fontWeight: '800', fontSize: 15, letterSpacing: .15 }, buttonTextDense: { fontSize: 13 }, buttonText_secondary: { color: colors.brandDark }, buttonText_danger: { color: colors.danger }, buttonText_ghost: { color: colors.brandDark },
  field: { gap: 6 }, fieldDense: { gap: 4 }, label: { color: colors.muted, fontSize: 11, fontWeight: '500' }, labelDense: { fontSize: 10 }, inputShell: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 13 }, inputShellDense: { minHeight: 38, gap: 6, paddingHorizontal: 11 }, textareaShell: { minHeight: 92, alignItems: 'flex-start', paddingTop: 12 }, input: { flex: 1, minHeight: 42, paddingVertical: 0, fontSize: 14, color: colors.ink }, inputDense: { minHeight: 36, fontSize: 13 }, textarea: { minHeight: 76, paddingTop: 0, textAlignVertical: 'top' }, error: { color: colors.danger, fontSize: 12, lineHeight: 18 }, muted: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 10 }, choiceSelected: { backgroundColor: colors.brand, borderColor: colors.brand }, choiceText: { color: colors.ink, fontWeight: '600' }, choiceTextSelected: { color: '#FFFDF8' },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.softGold, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }, badgeText: { color: colors.brandDark, fontSize: 11, fontWeight: '700' }, money: { color: colors.ink, fontSize: 17, fontWeight: '800', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) }, empty: { paddingVertical: 44, alignItems: 'center', gap: 8 }, emptyIcon: { color: colors.gold, fontSize: 40 },
  heroImage: { width: '100%', height: 220, borderRadius: 24, backgroundColor: colors.softGold }, heroImageCompact: { height: 112, borderRadius: 18 }, imagePlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line }, imagePlaceholderText: { color: colors.brandDark, fontWeight: '900', letterSpacing: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 4 }, rowLabel: { color: colors.muted, flex: 1 }, rowValue: { color: colors.ink, fontWeight: '700', textAlign: 'right', flex: 1 }, modal: { padding: 20, gap: 14 },
  h1: { fontSize: 19, fontWeight: '700', color: colors.ink, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) }, h2: { fontSize: 15, fontWeight: '700', color: colors.ink }, body: { color: colors.ink, fontSize: 13, lineHeight: 19 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, divider: { height: 1, backgroundColor: colors.line }, overline: { color: colors.brandDark, fontSize: 10, letterSpacing: .3, fontWeight: '800' }
});
