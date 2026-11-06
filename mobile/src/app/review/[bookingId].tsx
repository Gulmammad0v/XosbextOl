import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '@/api';
import type { ReviewEligibility } from '@/types';
import { Button, Card, Empty, HeroImage, Screen, run, s } from '@/ui';
import { colors } from '@/theme';
import { appLocale } from '@/format';
import { getAppLanguage } from '@/i18n';

type DetailKey = 'ratingFood' | 'ratingService' | 'ratingHall' | 'ratingValue';
const detailRows: { key: DetailKey; labelKey: string }[] = [
  { key: 'ratingFood', labelKey: 'review.food' },
  { key: 'ratingService', labelKey: 'review.service' },
  { key: 'ratingHall', labelKey: 'review.hallCleanliness' },
  { key: 'ratingValue', labelKey: 'review.value' },
];

export default function ReviewEditor() {
  const { t } = useTranslation();
  const language = getAppLanguage();
  const { bookingId: value } = useLocalSearchParams<{ bookingId: string }>();
  const bookingId = Number(value);
  const [eligibility, setEligibility] = useState<ReviewEligibility>();
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [details, setDetails] = useState<Partial<Record<DetailKey, number>>>({});
  const [comment, setComment] = useState('');

  useEffect(() => {
    api.reviewEligibility(bookingId).then(result => {
      setEligibility(result);
      if (result.review) {
        setRating(result.review.rating);
        setComment(result.review.comment || '');
        setDetails({
          ratingFood: result.review.ratingFood,
          ratingService: result.review.ratingService,
          ratingHall: result.review.ratingHall,
          ratingValue: result.review.ratingValue,
        });
      }
    }).finally(() => setLoading(false));
  }, [bookingId]);

  const editable = !!eligibility?.review && !!eligibility.editable;
  const canSubmit = !!rating && (!!eligibility?.eligible || editable);
  const submit = () => run(async () => {
    if (!eligibility || !canSubmit) return;
    const payload = { rating, ...details, comment: comment.trim() || null };
    if (eligibility.review) await api.updateReview(eligibility.review.id, payload);
    else await api.createReview({ bookingId, ...payload });
    router.back();
  }, t(eligibility?.review ? 'review.updated' : 'review.created'));

  if (!eligibility) return <Screen title={t('review.write')} loading={loading} back><Empty text={t('review.bookingNotFound')}/></Screen>;
  if (!eligibility.eligible && !editable) {
    const message = eligibility.review
      ? t('review.editExpired')
      : t('review.window', { opens: formatDate(eligibility.opensOn, language), closes: formatDate(eligibility.closesOn, language) });
    return <Screen title={t('review.write')} subtitle={t('review.subtitle')} back><Card><Text style={s.body}>{message}</Text></Card></Screen>;
  }

  return <Screen title={t(eligibility.review ? 'review.edit' : 'review.write')} subtitle={t('review.subtitle')} loading={loading} back>
    <Card style={styles.venueCard}>
      <View style={styles.cover}><HeroImage uri={eligibility.coverImageUrl} compact/><View style={styles.verifiedOverlay}><Ionicons name="checkmark-circle" size={14} color={colors.success}/><Text style={styles.verifiedText}>{t('venueDetails.verifiedWedding')}</Text></View></View>
      <View style={styles.venueDetails}><View style={{ flex: 1 }}><Text style={styles.venueName}>{eligibility.venueName}</Text><Text style={s.muted}>{formatDate(eligibility.eventDate, language)} · {t('booking.guest', { count: eligibility.guestCount })}</Text></View><Ionicons name="business-outline" size={22} color={colors.brandDark}/></View>
    </Card>

    <Card style={styles.overallCard}>
      <Text style={styles.cardTitle}>{t('review.overall')}</Text>
      <Stars value={rating} onChange={setRating} size={34} starLabel={star => t('review.stars', { count: star })}/>
      <Text style={s.muted}>{rating ? t(`review.rating${rating}`) : t('review.selectStars')}</Text>
    </Card>

    <Card>
      <Text style={styles.cardTitle}>{t('review.details')} <Text style={styles.optional}>({t('review.optional')})</Text></Text>
      {detailRows.map(row => <View key={row.key} style={styles.detailRow}><Text style={styles.detailLabel}>{t(row.labelKey)}</Text><Stars value={details[row.key] || 0} onChange={next => setDetails(current => ({ ...current, [row.key]: next }))} size={22} starLabel={star => t('review.stars', { count: star })}/></View>)}
    </Card>

    <View style={styles.commentSection}>
      <Text style={s.label}>{t('review.experience')}</Text>
      <TextInput
        multiline maxLength={1000} value={comment} onChangeText={setComment}
        placeholder={t('review.placeholder')}
        placeholderTextColor={colors.muted} style={styles.comment}/>
      <Text style={styles.counter}>{comment.length} / 1000</Text>
    </View>

    <View style={styles.notice}><Text style={styles.noticeText}>{t('review.notice')}</Text></View>
    <Button title={t(eligibility.review ? 'review.update' : 'review.submit')} onPress={submit} disabled={!canSubmit}/>
  </Screen>;
}

function Stars({ value, onChange, size, starLabel }: { value: number; onChange: (value: number) => void; size: number; starLabel: (star: number) => string }) {
  return <View style={styles.stars}>{[1, 2, 3, 4, 5].map(star => <Pressable key={star} accessibilityRole="button" accessibilityLabel={starLabel(star)} onPress={() => onChange(star)} hitSlop={5}><Ionicons name={star <= value ? 'star' : 'star-outline'} size={size} color={colors.brandDark}/></Pressable>)}</View>;
}

function formatDate(date: string, language: ReturnType<typeof getAppLanguage>) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(appLocale(language), { day: 'numeric', month: 'long', year: 'numeric' });
}

const styles = StyleSheet.create({
  venueCard: { padding: 10 },
  cover: { position: 'relative' },
  venueDetails: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 3, paddingBottom: 2 },
  venueName: { color: colors.ink, fontFamily: 'serif', fontSize: 17, fontWeight: '800' },
  verifiedOverlay: { position: 'absolute', left: 8, top: 8, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, backgroundColor: '#F6F1D4', paddingHorizontal: 9, paddingVertical: 5 },
  verifiedText: { color: colors.success, fontSize: 11, fontWeight: '700' },
  overallCard: { alignItems: 'center', paddingVertical: 18 },
  cardTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  optional: { fontWeight: '500', color: colors.muted },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  detailLabel: { flex: 1, color: colors.ink, fontSize: 13 },
  commentSection: { gap: 6 },
  comment: { minHeight: 120, padding: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.paper, color: colors.ink, fontSize: 13, textAlignVertical: 'top' },
  counter: { color: colors.muted, fontSize: 10, textAlign: 'right' },
  notice: { padding: 13, borderRadius: 12, backgroundColor: colors.softGold },
  noticeText: { color: colors.brandDark, fontSize: 11, lineHeight: 17 },
});
