import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AppLanguage } from './i18n';
import { colors } from './theme';

const choices: { language: AppLanguage; nameKey: string; descriptionKey: string; badge: string }[] = [
  { language: 'az', nameKey: 'language.azName', descriptionKey: 'language.azDescription', badge: 'AZ' },
  { language: 'en', nameKey: 'language.enName', descriptionKey: 'language.enDescription', badge: 'EN' },
  { language: 'ru', nameKey: 'language.ruName', descriptionKey: 'language.ruDescription', badge: 'RU' },
];

export function LanguageSelector({ value, onChange, deviceLanguage }: {
  value: AppLanguage;
  onChange: (language: AppLanguage) => void;
  deviceLanguage?: AppLanguage;
}) {
  const { t } = useTranslation();
  return <View style={styles.list}>{choices.map(choice => {
    const selected = choice.language === value;
    return <Pressable
      key={choice.language}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={() => onChange(choice.language)}
      style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && styles.pressed]}
    >
      <View style={[styles.badge, selected && styles.badgeSelected]}>
        <Text style={[styles.badgeText, selected && styles.badgeTextSelected]}>{choice.badge}</Text>
      </View>
      <View style={styles.copy}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{t(choice.nameKey)}</Text>
          {choice.language === deviceLanguage && <View style={styles.devicePill}><Text style={styles.deviceText}>{t('language.deviceLanguage')}</Text></View>}
        </View>
        <Text style={styles.description}>{t(choice.descriptionKey)}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <View style={styles.radioDot}/>} 
      </View>
    </Pressable>;
  })}</View>;
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  card: { minHeight: 76, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardSelected: { borderColor: colors.gold, borderWidth: 1.5, backgroundColor: '#FFFCF5' },
  pressed: { opacity: .72 },
  badge: { width: 43, height: 43, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softGold },
  badgeSelected: { backgroundColor: colors.brand },
  badgeText: { color: colors.brandDark, fontSize: 13, fontWeight: '800' },
  badgeTextSelected: { color: '#FFFDF8' },
  copy: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  name: { color: colors.ink, fontSize: 16, lineHeight: 21, fontWeight: '700' },
  description: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  devicePill: { backgroundColor: '#EDF1E3', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  deviceText: { color: colors.success, fontSize: 9, fontWeight: '700' },
  radio: { width: 23, height: 23, borderRadius: 12, borderWidth: 1.5, borderColor: '#8D877B', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.brand },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.brand },
});
