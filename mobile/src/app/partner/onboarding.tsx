import { useCallback, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/api';
import type { Agreement, MenuItemTemplate, OnboardingRequirement, VenueDetail, VenueOnboarding } from '@/types';
import { Badge, Button, Card, Chips, Empty, Field, FormModal, Money, Screen, SectionTitle, confirm, run, s } from '@/ui';
import { colors } from '@/theme';
import { MenuEditor, MenuEditorPayload } from '@/menu-editor';
import { takeSelectedLocation } from '@/location-selection';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { appLocale } from '@/format';
import { getAppLanguage } from '@/i18n';

const AZERBAIJANI_CHARACTERS: Record<string, string> = { ə: 'e', ı: 'i', ö: 'o', ü: 'u', ş: 's', ç: 'c', ğ: 'g' };
const slugify = (value: string) => value.toLocaleLowerCase('az').split('').map(character => AZERBAIJANI_CHARACTERS[character] || character).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
type ServiceAvailability = 'INCLUDED' | 'PAID' | 'UNAVAILABLE';
type ServiceDraft = { availability: ServiceAvailability; price: string; priceType: string };
const EMPTY_REQUIREMENTS: OnboardingRequirement[] = ['BASIC', 'HALL', 'HALL_PHOTOS', 'PHOTOS', 'MENU', 'DOCUMENTS', 'AGREEMENT']
  .map(code => ({ code, label: code, complete: false }));

export default function PartnerOnboarding() {
  const { t } = useTranslation();
  const locale = appLocale(getAppLanguage());
  const steps = [t('partnerOnboarding.steps.basic'), t('partnerOnboarding.steps.halls'), t('partnerOnboarding.steps.menu'), t('partnerOnboarding.steps.company')];
  const { venueId: rawId, section: rawSection } = useLocalSearchParams<{ venueId?: string; section?: string }>();
  const parsedVenueId = rawId ? Number(rawId) : undefined;
  const venueId = parsedVenueId && Number.isFinite(parsedVenueId) ? parsedVenueId : undefined;
  const initialSection = rawSection == null ? 0 : Math.max(0, Math.min(3, Number(rawSection)));
  const [step, setStep] = useState(initialSection);
  const [overview, setOverview] = useState(!!rawId && rawSection == null);
  const [detail, setDetail] = useState<VenueDetail>();
  const [status, setStatus] = useState<VenueOnboarding>();
  const [agreement, setAgreement] = useState<Agreement>();
  const [menuTemplates, setMenuTemplates] = useState<MenuItemTemplate[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [serviceDrafts, setServiceDrafts] = useState<Record<number, ServiceDraft>>({});
  const [loading, setLoading] = useState(!!venueId);
  const [busy, setBusy] = useState(false);
  const [renderedAt] = useState(() => Date.now());
  const basicsInitialized = useRef(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('Bakı');
  const [cityOpen, setCityOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [mapAddress, setMapAddress] = useState('');
  const [latitude, setLatitude] = useState('40.4093');
  const [longitude, setLongitude] = useState('49.8671');
  const [legalName, setLegalName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [finCode, setFinCode] = useState('');
  const [companyDocumentUrl, setCompanyDocumentUrl] = useState('');
  const [ownerIdentityDocumentUrl, setOwnerIdentityDocumentUrl] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [companyEditMessage, setCompanyEditMessage] = useState('');

  const load = useCallback(async (id: number, syncBasics = false) => {
    const [nextDetail, nextStatus, nextAgreement, nextTemplates, nextCities] = await Promise.all([api.partnerVenue(id), api.onboarding(id), api.agreement(), api.catalog<MenuItemTemplate[]>('menu-items'), api.catalog<string[]>('cities')]);
    setDetail(nextDetail); setStatus(nextStatus); setAgreement(nextAgreement); setMenuTemplates(nextTemplates); setCities(nextCities);
    setServiceDrafts(Object.fromEntries(nextDetail.services.map(service => [service.id, {
      availability: !service.active ? 'UNAVAILABLE' : Number(service.price) > 0 ? 'PAID' : 'INCLUDED',
      price: String(service.price ?? 0), priceType: service.priceType || service.price_type || 'FIXED',
    }])));
    if (syncBasics || !basicsInitialized.current) {
      setName(nextDetail.venue.name); setSlug(nextDetail.venue.slug); setDescription(nextDetail.description || '');
      setCity(nextDetail.venue.city || 'Bakı'); setAddress(nextDetail.venue.address); setMapAddress(nextDetail.venue.address);
      setLatitude(String(nextDetail.venue.latitude)); setLongitude(String(nextDetail.venue.longitude)); basicsInitialized.current = true;
    }
    setLegalName(nextStatus.legalName || ''); setTaxId(nextStatus.taxId || ''); setFinCode(nextStatus.finCode || ''); setCompanyDocumentUrl(nextStatus.companyDocumentUrl || '');
    setOwnerIdentityDocumentUrl(nextStatus.ownerIdentityDocumentUrl || '');
    setAccepted(nextStatus.agreementVersion === nextAgreement.version);
  }, []);
  useFocusEffect(useCallback(() => {
    const selected = takeSelectedLocation();
    if (selected) {
      setLatitude(String(selected.latitude)); setLongitude(String(selected.longitude));
      if (selected.address) { setAddress(selected.address); setMapAddress(selected.address); }
      else setMapAddress(t('partnerOnboarding.locationSelected'));
    }
    if (!venueId) {
      setLoading(true);
      Promise.all([api.agreement(), api.catalog<MenuItemTemplate[]>('menu-items'), api.catalog<string[]>('cities')])
        .then(([nextAgreement, nextTemplates, nextCities]) => {
          setAgreement(nextAgreement); setMenuTemplates(nextTemplates); setCities(nextCities);
        }).finally(() => setLoading(false));
      return;
    }
    load(venueId, !basicsInitialized.current).finally(() => setLoading(false));
  }, [load, t, venueId]));

  const saveBasics = () => run(async () => {
    setBusy(true);
    try {
      const saved = await api.saveVenue({ name: name.trim(), slug, description: description.trim() || null, city, address: address.trim(), latitude: Number(latitude), longitude: Number(longitude) }, venueId);
      if (!venueId) {
        router.replace({ pathname: '/partner/onboarding', params: { venueId: saved.id } } as any);
      } else {
        await load(venueId);
      }
    } finally { setBusy(false); }
  }, venueId ? t('partnerOnboarding.basicsUpdated') : t('partnerOnboarding.venueCreated'));

  const pickHallImage = (hallId: number) => run(async () => {
    if (!venueId) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: .9 });
    if (!result.canceled) { await api.uploadMedia(venueId, result.assets[0], hallId); await load(venueId); }
  }, t('partnerOnboarding.photoSaved'));
  const deleteMedia = (mediaId: number, hallImage = false) => confirm(
    t('partnerPhotos.deleteTitle'),
    hallImage ? t('partnerHallForm.deletePhotoMessage') : t('partnerPhotos.deleteMessage'),
    () => run(async () => {
      if (!venueId) return;
      await api.removeMedia(venueId, mediaId);
      await load(venueId);
    }, t('partnerPhotos.deleted')),
  );
  const saveMenu = (payload: MenuEditorPayload, menuId?: number) => run(async () => {
    if (!venueId) return;
    setBusy(true); try { await api.saveMenuPackage(venueId, payload, menuId); await load(venueId); } finally { setBusy(false); }
  }, t('partnerOnboarding.menuSaved'));
  const deleteMenu = (menuId: number, menuName: string) => {
    if (!venueId) return;
    confirm(t('partnerMenus.deleteTitle'), t('partnerMenus.deleteMessage', { name: menuName }), () => run(async () => { setBusy(true); try { await api.deleteMenuPackage(venueId, menuId); await load(venueId); } finally { setBusy(false); } }, t('partnerMenus.deleted')));
  };
  const updateServiceDraft = (serviceId: number, change: Partial<ServiceDraft>) => setServiceDrafts(values => ({ ...values, [serviceId]: { ...values[serviceId], ...change } }));
  const saveService = (serviceId: number, serviceName: string, description?: string) => run(async () => {
    if (!venueId) return;
    const draft = serviceDrafts[serviceId];
    if (!draft) return;
    setBusy(true);
    try {
      await api.updateService(venueId, serviceId, {
        name: serviceName, description: description || null,
        price: draft.availability === 'PAID' ? Number(draft.price) : 0,
        priceType: draft.priceType, active: draft.availability !== 'UNAVAILABLE',
      });
      await load(venueId);
    } finally { setBusy(false); }
  }, t('partnerOnboarding.serviceSaved'));
  const pickDocument = (documentType: 'COMPANY' | 'IDENTITY') => run(async () => {
    if (!venueId) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .9 });
    if (result.canceled) return;
    setBusy(true);
    try {
      const uploaded = await api.uploadVenueDocument(venueId, documentType, result.assets[0]);
      if (documentType === 'COMPANY') setCompanyDocumentUrl(uploaded.url);
      else setOwnerIdentityDocumentUrl(uploaded.url);
    } finally { setBusy(false); }
  }, t('partnerOnboarding.documentUploaded'));
  const savePayment = () => run(async () => {
    if (!venueId) return;
    setBusy(true); try {
      await api.saveLegal(venueId, { legalName: legalName.trim(), taxId: taxId.trim(), finCode, companyDocumentUrl, ownerIdentityDocumentUrl });
      if (!managedVenue && accepted && agreement) await api.acceptAgreement(venueId, { accepted: true, version: agreement.version });
      await load(venueId);
    } finally { setBusy(false); }
  }, managedVenue ? t('partnerOnboarding.changesSubmitted') : t('partnerOnboarding.companySaved'));
  const requestCompanyEdit = () => run(async () => {
    if (!venueId) return;
    setBusy(true); try {
      await api.requestCompanyEdit(venueId, companyEditMessage.trim());
      setCompanyEditMessage('');
      await load(venueId);
    } finally { setBusy(false); }
  }, t('partnerOnboarding.requestSent'));
  const submit = () => run(async () => { if (!venueId) return; await api.submitVenue(venueId); await load(venueId); }, t('partnerOnboarding.submitted'));

  const requirements = status?.requirements || EMPTY_REQUIREMENTS;
  const completionPercent = status?.completionPercent || 0;
  const waiting = !!status && ['PENDING', 'ACTIVE'].includes(status.status);
  const managedVenue = !!status && (status.status === 'ACTIVE' || status.criticalChangeStatus?.startsWith('REAPPROVAL_'));
  const companyGrantActive = status?.companyEditStatus === 'APPROVED'
    && !!status.companyEditAllowedUntil && new Date(status.companyEditAllowedUntil).getTime() > renderedAt
    && !status.companyEditUsedAt;
  const companyLocked = managedVenue && !companyGrantActive;
  const companyRequestPending = status?.companyEditStatus === 'REQUESTED';
  const canRequestCompanyEdit = status?.status === 'ACTIVE' && !companyRequestPending && !companyGrantActive;
  const venueMedia = detail?.media.filter(media => (media.hallId ?? media.hall_id) == null) || [];
  const basicsValid = !!name.trim() && !!slug && !!city && !!address.trim()
    && Number.isFinite(Number(latitude)) && Number(latitude) >= -90 && Number(latitude) <= 90
    && Number.isFinite(Number(longitude)) && Number(longitude) >= -180 && Number(longitude) <= 180;
  if (overview && venueId && detail && status) {
    const rows = [
      { icon: 'information-circle-outline' as const, title: t('manageVenue.basicInfo'), subtitle: t('manageVenue.basicInfoSubtitle'), step: 0, complete: requirements.find(item => item.code === 'BASIC')?.complete },
      { icon: 'images-outline' as const, title: t('partnerPhotos.title'), subtitle: t('partnerOnboarding.minimumPhotos', { count: venueMedia.length, minimum: 5 }), route: '/partner/photos', complete: requirements.find(item => item.code === 'PHOTOS')?.complete },
      { icon: 'business-outline' as const, title: t('partnerHalls.title'), subtitle: t('partnerOnboarding.hallsOverview', { count: detail.halls.length }), route: '/partner/halls', complete: requirements.find(item => item.code === 'HALL')?.complete && requirements.find(item => item.code === 'HALL_PHOTOS')?.complete },
      { icon: 'restaurant-outline' as const, title: t('partnerMenus.title'), subtitle: t('partnerOnboarding.menuRequired'), route: '/partner/menus', complete: requirements.find(item => item.code === 'MENU')?.complete },
      { icon: 'briefcase-outline' as const, title: t('partnerProfile.companyDetails'), subtitle: t('manageVenue.companyInfoSubtitle'), step: 3, complete: requirements.filter(item => ['DOCUMENTS', 'AGREEMENT'].includes(item.code)).every(item => item.complete) },
    ];
    return <Screen title={name} subtitle={t('partnerOnboarding.registration')} loading={loading}>
      <Card><View style={styles.progressHeader}><Text style={s.muted}>{t('partnerOnboarding.completion')}</Text><Text style={s.title}>{completionPercent}%</Text></View><View style={styles.progress}><View style={[styles.progressFill, { width: `${completionPercent}%` }]}/></View><Text style={s.muted}>{t('partnerOnboarding.completionInfo', { count: requirements.filter(item => !item.complete).length })}</Text></Card>
      <Text style={styles.groupLabel}>{t('partnerOnboarding.requirements')}</Text>
      <View style={styles.requirementGroup}>{rows.map((item, index) => <Pressable key={item.title} onPress={() => { if (item.route) router.push({ pathname: item.route as any, params: { venueId, name } }); else { setStep(item.step!); setOverview(false); } }} style={[styles.requirementRow, index < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }]}><View style={styles.requirementIcon}><Ionicons name={item.icon} size={19} color={colors.brandDark}/></View><View style={{ flex: 1 }}><Text style={s.h2}>{item.title}</Text><Text style={s.muted}>{item.subtitle}</Text></View>{item.complete ? <Ionicons name="checkmark-circle-outline" size={20} color={colors.success}/> : <View style={styles.conflict}><Text style={styles.conflictText}>{t('partnerOnboarding.missing')}</Text></View>}</Pressable>)}</View>
      <Text style={styles.groupLabel}>{t('partnerOnboarding.optional')}</Text><View style={styles.requirementGroup}><Pressable onPress={() => router.push({ pathname: '/partner/amenities', params: { venueId, name } } as any)} style={[styles.optionalRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }]}><View style={styles.requirementIcon}><Ionicons name="options-outline" size={19} color={colors.brandDark}/></View><Text style={[s.body, { flex: 1 }]}>{t('partnerAmenities.title')}</Text><Ionicons name="chevron-forward" size={17} color={colors.muted}/></Pressable><Pressable onPress={() => router.push({ pathname: '/partner/services', params: { venueId, name } } as any)} style={styles.optionalRow}><View style={styles.requirementIcon}><Ionicons name="sparkles-outline" size={19} color={colors.brandDark}/></View><Text style={[s.body, { flex: 1 }]}>{t('partnerServices.title')}</Text><Ionicons name="chevron-forward" size={17} color={colors.muted}/></Pressable></View>
      <Button title={waiting ? (status.status === 'ACTIVE' ? t('partnerOnboarding.active') : t('partnerOnboarding.awaitingApproval')) : t('partnerOnboarding.submit')} onPress={submit} disabled={waiting || completionPercent < 100 || status.frozen}/>
    </Screen>;
  }
  return <Screen
    title={steps[step]}
    subtitle={name || t('partnerOnboarding.newVenue')}
    loading={loading}
    footer={step === 0 ? <Button title={busy ? t('common.saving') : venueId ? t('common.save') : t('partnerOnboarding.createAndContinue')} onPress={saveBasics} disabled={busy || !basicsValid}/> : undefined}
  >

    {step === 0 && <>
      <Text style={styles.formSectionLabel}>{t('partnerOnboarding.venueSection')}</Text>
      <View style={styles.basicCard}>
        <Field label={t('partnerOnboarding.venueName')} value={name} onChangeText={value => { setName(value); if (!venueId) setSlug(slugify(value)); }}/>
        {!!venueId && <View style={styles.reviewNote}><Ionicons name="information-circle-outline" size={13} color={colors.brandDark}/><Text style={styles.reviewNoteText}>{t('partnerOnboarding.reviewNote')}</Text></View>}
        <Field label={t('partnerServices.description')} value={description} onChangeText={setDescription} multiline maxLength={500}/>
        <Text style={styles.characterCount}>{description.length} / 500</Text>
      </View>

      <Text style={styles.formSectionLabel}>{t('partnerOnboarding.addressSection')}</Text>
      <View style={styles.basicCard}>
        <View style={styles.fieldBlock}>
          <Text style={s.label}>{t('common.city')}</Text>
          <Pressable onPress={() => setCityOpen(true)} style={({ pressed }) => [styles.selectField, pressed && styles.pressed]}>
            <Text style={styles.selectValue}>{city}</Text><Ionicons name="chevron-down" size={14} color={colors.brandDark}/>
          </Pressable>
        </View>
        <Field label={t('partnerOnboarding.exactAddress')} value={address} onChangeText={setAddress}/>
        {!!venueId && <View style={styles.reviewNote}><Ionicons name="information-circle-outline" size={13} color={colors.brandDark}/><Text style={styles.reviewNoteText}>{t('partnerOnboarding.reviewNote')}</Text></View>}
        <Text style={s.label}>{t('partnerOnboarding.mapLocation')}</Text>
        <Pressable onPress={() => router.push({ pathname: '/partner/location-picker', params: { latitude, longitude } } as any)} style={({ pressed }) => [styles.mapPreview, pressed && styles.pressed]}>
          <View style={styles.mapGrid}/>
          <Ionicons name="location-outline" size={31} color={colors.brand}/>
          <View style={styles.coordinatePill}><Text style={styles.coordinateText}>{Number(latitude).toFixed(4)}, {Number(longitude).toFixed(4)}</Text></View>
        </Pressable>
        <Button title={t('partnerOnboarding.changeOnMap')} variant="secondary" onPress={() => router.push({ pathname: '/partner/location-picker', params: { latitude, longitude } } as any)}/>
        {!!mapAddress && mapAddress !== address && <Text style={styles.mapAddress} numberOfLines={2}>{mapAddress}</Text>}
      </View>

      <FormModal visible={cityOpen} title={t('partnerOnboarding.selectCity')} onClose={() => setCityOpen(false)}>
        {cities.map(value => <Pressable key={value} onPress={() => { setCity(value); setCityOpen(false); }} style={[styles.cityOption, city === value && styles.cityOptionSelected]}>
          <Text style={[styles.cityOptionText, city === value && styles.cityOptionTextSelected]}>{value}</Text>
          {city === value && <Ionicons name="checkmark" size={18} color="#fff"/>}
        </Pressable>)}
      </FormModal>
    </>}
    {step === 1 && detail && <><View style={s.titleRow}><SectionTitle>{t('partnerOnboarding.hallsAndPhotos')}</SectionTitle><Button title={t('partnerOnboarding.addHall')} compact onPress={() => router.push({ pathname: '/partner/hall-form', params: { venueId } } as any)}/></View>{detail.halls.length ? detail.halls.map(hall => { const hallMedia = detail.media.filter(media => (media.hallId ?? media.hall_id) === hall.id); return <Card key={hall.id}><View style={s.titleRow}><View style={{ flex: 1 }}><Text style={s.h2}>{hall.name}</Text><Text style={s.muted}>{t('partnerOnboarding.hallSummary', { min: hall.capacityMin, max: hall.capacityMax, count: hallMedia.length })}</Text></View></View>{hallMedia.length ? <View style={styles.photos}>{hallMedia.map(media => <View key={media.id} style={styles.photoItem}><Image source={{ uri: media.thumbUrl || media.thumb_url || media.url }} style={styles.photoPreview}/><Button title={t('common.delete')} compact variant="danger" onPress={() => deleteMedia(media.id, true)}/></View>)}</View> : <Text style={styles.missing}>{t('partnerOnboarding.hallPhotoRequired')}</Text>}<View style={s.actions}><Button title={t('partnerOnboarding.addHallPhoto')} compact onPress={() => pickHallImage(hall.id)}/><Button title={t('common.edit')} compact variant="secondary" onPress={() => router.push({ pathname: '/partner/hall-form', params: { venueId, hallId: hall.id } } as any)}/></View></Card>; }) : <Empty text={t('partnerOnboarding.hallRequired')}/>}</>}
    {step === 2 && detail && <><SectionTitle>{t('partnerOnboarding.menus')}</SectionTitle><Text style={s.muted}>{t('partnerOnboarding.menuIntro')}</Text>{detail.menus.map(menu => <Card key={menu.id}><View style={s.titleRow}><Text style={[s.h2, { flex: 1 }]}>{menu.name}</Text><Money value={menu.pricePerPerson}/></View><MenuEditor menu={menu} templates={menuTemplates} defaultTier={menu.tier} busy={busy} onSave={payload => saveMenu(payload, menu.id)}/><Button title={t('partnerMenus.deleteTitle')} variant="danger" onPress={() => deleteMenu(menu.id, menu.name)} disabled={busy}/></Card>)}<Card><Text style={s.h2}>{t('partnerMenus.newMenu')}</Text><MenuEditor key={detail.menus.length} templates={menuTemplates} defaultTier={detail.menus.length + 1} busy={busy} onSave={payload => saveMenu(payload)}/></Card><SectionTitle>{t('partnerOnboarding.serviceItems')}</SectionTitle><Text style={s.muted}>{t('partnerOnboarding.serviceIntro')}</Text>{detail.services.map(service => { const draft = serviceDrafts[service.id]; if (!draft) return null; return <Card key={service.id}><Text style={s.h2}>{service.name}</Text><Chips options={['INCLUDED', 'PAID', 'UNAVAILABLE'].map(value => ({ value, label: t(`partnerServices.availabilityOptions.${value}`) }))} value={draft.availability} onChange={availability => updateServiceDraft(service.id, { availability })}/>{draft.availability === 'PAID' && <><Field label={t('partnerOnboarding.priceAzn')} value={draft.price} onChangeText={price => updateServiceDraft(service.id, { price })} keyboardType="decimal-pad"/><Text style={s.label}>{t('partnerServices.priceType')}</Text><Chips options={['FIXED', 'PER_PERSON'].map(value => ({ value, label: t(`partnerServices.priceTypes.${value}`) }))} value={draft.priceType} onChange={priceType => updateServiceDraft(service.id, { priceType })}/></>}<Button title={t('partnerOnboarding.saveService')} onPress={() => saveService(service.id, service.name, service.description)} disabled={busy || (draft.availability === 'PAID' && (!Number.isFinite(Number(draft.price)) || Number(draft.price) <= 0))}/></Card>; })}</>}
    {step === 3 && <>
      <Card>
        <SectionTitle>{t('partnerProfile.companyDetails')}</SectionTitle>
        {companyRequestPending && <Text style={s.muted}>{t('partnerOnboarding.editRequestPending')}</Text>}
        {companyGrantActive && <Text style={s.muted}>{t('partnerOnboarding.editGrantActive', { date: new Date(status!.companyEditAllowedUntil!).toLocaleDateString(locale) })}</Text>}
        {status?.companyEditStatus === 'CHANGES_PENDING' && <Text style={s.muted}>{t('partnerOnboarding.changesPending')}</Text>}
        {status?.companyEditStatus === 'REJECTED' && status.companyEditDecisionReason && <Text style={styles.rejected}>{t('partnerOnboarding.adminReason', { reason: status.companyEditDecisionReason })}</Text>}
        <Field label={t('partnerOnboarding.legalName')} value={legalName} onChangeText={setLegalName} editable={!companyLocked}/>
        <Field label={t('partnerOnboarding.taxId')} value={taxId} onChangeText={value => setTaxId(value.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={10} editable={!companyLocked}/>
        <Field label={t('partnerOnboarding.finCode')} value={finCode} onChangeText={value => setFinCode(value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} autoCapitalize="characters" maxLength={7} editable={!companyLocked}/>
        <Text style={s.label}>{t('partnerOnboarding.companyDocument')}</Text>
        {companyDocumentUrl ? <Image source={{ uri: companyDocumentUrl }} style={styles.documentPhoto}/> : <Text style={styles.missing}>{t('partnerOnboarding.companyDocumentMissing')}</Text>}
        <Button title={companyDocumentUrl ? t('partnerOnboarding.changeCompanyDocument') : t('partnerOnboarding.selectCompanyDocument')} variant="secondary" onPress={() => pickDocument('COMPANY')} disabled={busy || companyLocked}/>
        <Text style={s.label}>{t('partnerOnboarding.identityDocument')}</Text>
        {ownerIdentityDocumentUrl ? <Image source={{ uri: ownerIdentityDocumentUrl }} style={styles.documentPhoto}/> : <Text style={styles.missing}>{t('partnerOnboarding.identityDocumentMissing')}</Text>}
        <Button title={ownerIdentityDocumentUrl ? t('partnerOnboarding.changeIdentityDocument') : t('partnerOnboarding.selectIdentityDocument')} variant="secondary" onPress={() => pickDocument('IDENTITY')} disabled={busy || companyLocked}/>
      </Card>
      <Card>
        <View style={s.titleRow}><Text style={[s.h2, { flex: 1 }]}>{agreement?.title}</Text>{agreement?.testDocument && <Badge value="TEST"/>}</View>
        <Text style={styles.contract}>{agreement?.content}</Text>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted, disabled: managedVenue }} disabled={managedVenue} onPress={() => setAccepted(value => !value)} style={styles.agreementRow}>
          <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>{accepted && <Text style={styles.checkmark}>✓</Text>}</View>
          <Text style={[s.body, { flex: 1 }]}>{t('partnerOnboarding.acceptAgreement')}</Text>
        </Pressable>
        <Button title={companyGrantActive ? (busy ? t('common.saving') : t('partnerOnboarding.submitChanges')) : managedVenue ? t('partnerOnboarding.changesLocked') : busy ? t('common.saving') : t('partnerOnboarding.saveAndAccept')} onPress={savePayment} disabled={companyLocked || busy || !legalName.trim() || taxId.length !== 10 || !/^[A-Z0-9]{7}$/.test(finCode) || !companyDocumentUrl || !ownerIdentityDocumentUrl || (!managedVenue && !accepted)}/>
      </Card>
      {canRequestCompanyEdit && <Card>
        <Text style={s.muted}>{t('partnerOnboarding.editRequestInfo')}</Text>
        <Field label={t('partnerOnboarding.adminNote')} value={companyEditMessage} onChangeText={setCompanyEditMessage} multiline maxLength={1000} placeholder={t('partnerOnboarding.editReasonPlaceholder')}/>
        <Pressable
          accessibilityRole="button"
          disabled={busy || !companyEditMessage.trim()}
          onPress={requestCompanyEdit}
          style={({ pressed }) => [styles.companyEditButton, (pressed || busy || !companyEditMessage.trim()) && styles.companyEditButtonDisabled]}
        >
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.82} style={styles.companyEditButtonText}>{t('partnerOnboarding.requestEdit')}</Text>
        </Pressable>
      </Card>}
    </>}

  </Screen>;
}

const styles = StyleSheet.create({
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, progress: { height: 7, borderRadius: 10, backgroundColor: colors.line, overflow: 'hidden' }, progressFill: { height: '100%', backgroundColor: colors.gold }, rejected: { color: colors.danger, lineHeight: 20 }, steps: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 }, stepItem: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 5, borderRadius: 10 }, stepPressed: { backgroundColor: colors.softGold }, stepDisabled: { opacity: .45 }, stepDot: { width: 28, height: 28, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper }, stepDotActive: { backgroundColor: colors.brand, borderColor: colors.brand }, stepNumber: { color: colors.muted, fontSize: 12, fontWeight: '800' }, stepNumberActive: { color: 'white' }, stepLabel: { color: colors.muted, fontSize: 9, lineHeight: 12, textAlign: 'center' }, stepLabelActive: { color: colors.ink, fontWeight: '800' },
  groupLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: .5, marginLeft: 4 }, requirementGroup: { overflow: 'hidden', borderRadius: 17, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper }, requirementRow: { minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 }, requirementIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softGold }, conflict: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#F4DFDC' }, conflictText: { color: colors.danger, fontSize: 10, fontWeight: '700' }, optionalRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, photoItem: { width: '31%', gap: 4 }, photoPreview: { width: '100%', height: 90, borderRadius: 13 }, documentPhoto: { width: '100%', height: 190, borderRadius: 14, backgroundColor: colors.softGold }, contract: { color: colors.ink, fontSize: 13, lineHeight: 20 }, agreementRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }, checkbox: { width: 25, height: 25, borderRadius: 6, borderWidth: 2, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }, checkboxChecked: { backgroundColor: colors.brand, borderColor: colors.brand }, checkmark: { color: 'white', fontWeight: '900' }, complete: { color: colors.success }, missing: { color: colors.danger },
  formSectionLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: .8, marginTop: 3, marginLeft: 4 },
  basicCard: { gap: 11, padding: 12, borderRadius: 17, backgroundColor: colors.paper },
  reviewNote: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -6 },
  reviewNoteText: { color: colors.brandDark, fontSize: 8.5, lineHeight: 12 },
  characterCount: { color: colors.muted, fontSize: 8, textAlign: 'right', marginTop: -8 },
  fieldBlock: { gap: 6 },
  selectField: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  selectValue: { color: colors.ink, fontSize: 14 },
  mapPreview: { height: 100, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: '#F8F1E1' },
  mapGrid: { position: 'absolute', inset: 0, opacity: .45, borderWidth: 16, borderColor: 'rgba(191, 169, 122, .08)' },
  coordinatePill: { position: 'absolute', left: 9, bottom: 9, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9, backgroundColor: colors.paper },
  coordinateText: { color: colors.ink, fontSize: 8, fontWeight: '700' },
  mapAddress: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: -6 },
  cityOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  cityOptionSelected: { borderColor: colors.brand, backgroundColor: colors.brand },
  cityOptionText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  cityOptionTextSelected: { color: '#fff' },
  companyEditButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: colors.goldLight, backgroundColor: colors.paper },
  companyEditButtonDisabled: { opacity: .48 },
  companyEditButtonText: { color: colors.brandDark, fontSize: 11, lineHeight: 15, fontWeight: '700', textAlign: 'center' },
  pressed: { opacity: .68 }
});
