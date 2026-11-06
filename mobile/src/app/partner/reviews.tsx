import { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api } from '@/api';
import type { Review, VenueDetail } from '@/types';
import { Button, Card, Empty, Field, FormModal, Screen, run, s } from '@/ui';
import { colors } from '@/theme';
import { useTranslation } from 'react-i18next';
import { appLocale } from '@/format';
import { getAppLanguage } from '@/i18n';

export default function Reviews() {
  const { t } = useTranslation();
  const locale = appLocale(getAppLanguage());
  const p = useLocalSearchParams<{ venueId: string; name?: string }>(); const venueId = Number(p.venueId);
  const [items, setItems] = useState<Review[]>([]); const [detail, setDetail] = useState<VenueDetail>(); const [drafts, setDrafts] = useState<Record<number, string>>({}); const [loading, setLoading] = useState(true);
  const [reporting, setReporting] = useState<Review>(); const [reportReason, setReportReason] = useState('');
  const load = useCallback(async () => { const [venue, result] = await Promise.all([api.partnerVenue(venueId), api.reviews(venueId)]); setDetail(venue); setItems(result.content || []); }, [venueId]);
  useFocusEffect(useCallback(() => { load().finally(() => setLoading(false)); }, [load]));
  const send = (id: number) => run(async () => { await api.replyReview(id, drafts[id].trim()); await load(); }, t('partnerReviews.replySent'));
  const report = () => reporting && run(async () => { await api.reportReview(reporting.id, reportReason.trim()); setReporting(undefined); setReportReason(''); await load(); }, t('partnerReviews.reportSent'));
  return <Screen title={t('partnerReviews.title')} subtitle={p.name} loading={loading} partnerNav={{ venueId, hallId: detail?.halls[0]?.id, venueName: p.name }}>
    <Card><View style={styles.score}><Text style={styles.big}>{Number(detail?.venue.ratingAvg ?? detail?.venue.rating ?? 0).toFixed(1)}</Text><View><Text style={styles.stars}>★★★★★</Text><Text style={s.muted}>{t('partnerReviews.basedOn', { count: detail?.venue.reviewCount || items.length })}</Text></View></View></Card>
    {!items.length ? <Empty text={t('partnerReviews.empty')}/> : items.map(item => { const answer = item.ownerReply || item.owner_reply || item.reply; const created = item.createdAt || item.created_at; return <Card key={item.id}><View style={s.titleRow}><Text style={[s.h2, { flex: 1 }]}>{item.userName || item.user_name || t('partnerReviews.customer')}</Text><Text style={s.muted}>{created ? new Date(created).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : ''}</Text></View><Text style={styles.stars}>{'★'.repeat(item.rating)}{'☆'.repeat(5-item.rating)}</Text><Text style={s.body}>{item.comment || t('partnerReviews.noComment')}</Text>{answer ? <View style={styles.answer}><Text style={s.label}>{t('partnerReviews.yourReply')}</Text><Text style={s.body}>{answer}</Text></View> : <View style={styles.reply}><TextInput placeholder={t('partnerReviews.replyPlaceholder')} placeholderTextColor={colors.muted} value={drafts[item.id] || ''} onChangeText={text => setDrafts(value => ({ ...value, [item.id]: text }))} style={styles.input}/><Button title={t('common.send')} compact variant="ghost" onPress={() => send(item.id)} disabled={!drafts[item.id]?.trim()}/></View>}<View style={s.titleRow}>{item.moderationStatus === 'PENDING' ? <Text style={s.muted}>{t('partnerReviews.pendingModeration')}</Text> : <Button title={t('partnerReviews.report')} compact variant="ghost" onPress={() => { setReporting(item); setReportReason(''); }}/>}</View></Card>; })}
    <FormModal visible={!!reporting} title={t('partnerReviews.reportTitle')} onClose={() => setReporting(undefined)}><Text style={s.muted}>{t('partnerReviews.reportInfo')}</Text><Field label={t('partnerReviews.reportReason')} value={reportReason} onChangeText={setReportReason} multiline maxLength={1000}/><Button title={t('partnerReviews.sendToAdmin')} onPress={report} disabled={!reportReason.trim()}/></FormModal>
  </Screen>;
}
const styles = StyleSheet.create({ score: { flexDirection: 'row', alignItems: 'center', gap: 14 }, big: { color: colors.ink, fontSize: 36, fontFamily: 'serif', fontWeight: '700' }, stars: { color: colors.brandDark, fontWeight: '800', letterSpacing: 1 }, answer: { backgroundColor: '#F5EFDF', padding: 10, borderLeftWidth: 2, borderLeftColor: colors.gold, borderRadius: 3 }, reply: { minHeight: 42, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingLeft: 11 }, input: { flex: 1, color: colors.ink, fontSize: 13 } });
