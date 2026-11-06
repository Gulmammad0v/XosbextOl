import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { clearBiometricRefreshToken, getDeviceId, updateBiometricRefreshTokenIfEnabled } from './biometric-session';
import type { Agreement, Booking, Hall, Page, Payment, Profile, ReviewEligibility, ReviewPage, Tokens, UserDevice, UserDeviceList, Venue, VenueDetail, VenueOnboarding } from './types';
import type { SocialProvider } from './social-auth';
import { getAppLanguage, translate, type AppLanguage } from './i18n';

const API_PORT = process.env.EXPO_PUBLIC_API_PORT || '8090';
const REQUEST_TIMEOUT_MS = 15_000;

function getDevelopmentHost() {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return undefined;
  try {
    return new URL(hostUri.includes('://') ? hostUri : `http://${hostUri}`).hostname;
  } catch {
    return hostUri.split(':')[0];
  }
}

const developmentHost = getDevelopmentHost();
const nativeDevelopmentHost = developmentHost && !['localhost', '127.0.0.1', '::1'].includes(developmentHost)
  ? developmentHost
  : undefined;
const defaultHost = nativeDevelopmentHost || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
const DEFAULT_API_URL = `http://${defaultHost}:${API_PORT}`;
const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || DEFAULT_API_URL;
let tokens: Tokens | null = null;
let onExpired: (() => void) | undefined;
let refreshOperation: { session: Tokens; promise: Promise<void> } | null = null;

export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown, public code?: string) { super(message); }
}

export async function saveTokens(value: Tokens | null) {
  tokens = value;
  try {
    if (value) await updateBiometricRefreshTokenIfEnabled(value.refreshToken);
    else await clearBiometricRefreshToken();
  } catch { /* the active session remains in memory if secure persistence is unavailable */ }
}
export function getCurrentRefreshToken() { return tokens?.refreshToken ?? null; }
export function setExpiredHandler(handler: () => void) { onExpired = handler; }

type Options = RequestInit & { json?: unknown; auth?: boolean; retry?: boolean; timeoutMs?: number };

async function refreshTokensOnce(session: Tokens) {
  if (tokens !== session) return;
  if (refreshOperation?.session === session) return refreshOperation.promise;

  const promise = (async () => {
    const fresh = await request<Tokens>('/api/auth/refresh', {
      method: 'POST',
      json: { refreshToken: session.refreshToken, deviceId: await getDeviceId() },
      auth: false,
      retry: false,
    });
    if (tokens === session) await saveTokens(fresh);
  })();
  refreshOperation = { session, promise };
  try {
    await promise;
  } finally {
    if (refreshOperation?.promise === promise) refreshOperation = null;
  }
}

async function request<T = void>(path: string, options: Options = {}): Promise<T> {
  const requestTokens = tokens;
  const headers = new Headers(options.headers);
  headers.set('Accept-Language', getAppLanguage());
  if (options.auth !== false && requestTokens) headers.set('Authorization', `Bearer ${requestTokens.accessToken}`);
  let body = options.body;
  if (options.json !== undefined) { headers.set('Content-Type', 'application/json'); body = JSON.stringify(options.json); }
  let response: Response;
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { timeoutMs: _timeoutMs, ...fetchOptions } = options;
    response = await fetch(`${API_URL}${path}`, { ...fetchOptions, headers, body, signal: options.signal ?? controller.signal });
  } catch {
    if (controller.signal.aborted) throw new ApiError(translate('errors.timeout'), 0, undefined, 'NETWORK_TIMEOUT');
    throw new ApiError(translate('errors.network'), 0, undefined, 'NETWORK_UNAVAILABLE');
  } finally {
    clearTimeout(timeout);
  }
  if (response.status === 401 && requestTokens && options.auth !== false
      && options.retry !== false && !path.startsWith('/api/auth/')) {
    try {
      await refreshTokensOnce(requestTokens);
      return request<T>(path, { ...options, retry: false });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401 && tokens === requestTokens) {
        await saveTokens(null);
        onExpired?.();
        throw new ApiError(translate('errors.authExpired'), 401, undefined, 'AUTH_TOKEN_EXPIRED');
      }
      throw error;
    }
  }
  const text = await response.text();
  let result: unknown = undefined;
  if (text) { try { result = JSON.parse(text); } catch { result = text; } }
  if (!response.ok) {
    const data = result as Record<string, unknown> | undefined;
    const code = typeof data?.code === 'string' ? data.code : undefined;
    throw new ApiError(String(data?.message || data?.detail || translate('errors.generic')), response.status, result, code);
  }
  return result as T;
}

const query = (params: Record<string, unknown>) => {
  const value = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
  return value ? `?${value}` : '';
};
const idempotencyKey = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function devicePayload() {
  return {
    deviceId: await getDeviceId(),
    deviceName: Device.modelName || (Platform.OS === 'ios' ? 'iPhone' : 'Android cihaz'),
    platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
    osVersion: Device.osVersion || String(Platform.Version),
    appVersion: Constants.expoConfig?.version || '1.0.0',
  };
}

function sameDeviceDetails(current: UserDevice, candidate: UserDevice) {
  const normalized = (value?: string) => value?.trim().toLocaleLowerCase('az-AZ') || '';
  return current.platform === candidate.platform
    && normalized(current.deviceName) === normalized(candidate.deviceName)
    && normalized(current.osVersion) === normalized(candidate.osVersion)
    && normalized(current.appVersion) === normalized(candidate.appVersion)
    && (!current.lastCity || !candidate.lastCity || normalized(current.lastCity) === normalized(candidate.lastCity));
}

async function repairDuplicateDeviceRecords() {
  const data = await request<UserDeviceList>('/api/users/me/devices');
  const current = data.devices.find(device => device.current);
  if (!current) return 0;
  const duplicates = data.devices.filter(device => !device.current && sameDeviceDetails(current, device));
  for (const duplicate of duplicates) {
    await request(`/api/users/me/devices/${duplicate.id}`, { method: 'DELETE' });
  }
  return duplicates.length;
}

export const api = {
  login: async (email: string, password: string) => request<Tokens>('/api/auth/login', { method: 'POST', json: { email, password, ...await devicePayload() }, auth: false }),
  replaceDevice: (id: number, limitToken: string) => request<Tokens>(`/api/auth/devices/${id}/revoke`, { method: 'POST', json: { limitToken }, auth: false }),
  refresh: async (refreshToken: string) => request<Tokens>('/api/auth/refresh', { method: 'POST', json: { refreshToken, deviceId: await getDeviceId() }, auth: false, retry: false }),
  socialChallenge: (provider: SocialProvider) => request<{ challenge: string; nonce: string }>('/api/auth/social/challenge', { method: 'POST', json: { provider }, auth: false }),
  socialLogin: async (data: { provider: SocialProvider; idToken: string; challenge: string; firstName?: string; lastName?: string }) => request<Tokens>('/api/auth/social/login', { method: 'POST', json: { ...data, ...await devicePayload() }, auth: false }),
  sendRegistrationOtp: (email: string) => request('/api/auth/register/otp/send', { method: 'POST', json: { email }, auth: false }),
  verifyRegistrationOtp: (email: string, code: string) => request<{ token: string; expiresIn: number }>('/api/auth/register/otp/verify', { method: 'POST', json: { email, code }, auth: false }),
  completeRegistration: async (data: { token: string; firstName: string; lastName: string; birthDate: string; role: 'CUSTOMER' | 'VENUE_OWNER'; phone?: string; password: string; confirmPassword: string }) => request<Tokens>('/api/auth/register/complete', { method: 'POST', json: { ...data, ...await devicePayload() }, auth: false }),
  sendPasswordResetOtp: (email: string) => request('/api/auth/password/forgot/otp/send', { method: 'POST', json: { email }, auth: false }),
  verifyPasswordResetOtp: (email: string, code: string) => request<{ token: string; expiresIn: number }>('/api/auth/password/forgot/otp/verify', { method: 'POST', json: { email, code }, auth: false }),
  resetPassword: (token: string, newPassword: string, confirmPassword: string) => request('/api/auth/password/reset', { method: 'POST', json: { token, newPassword, confirmPassword }, auth: false }),
  changePassword: (currentPassword: string | undefined, newPassword: string, confirmPassword: string) => request('/api/users/me/password', { method: 'PUT', json: { currentPassword, newPassword, confirmPassword } }),
  logout: async (refreshToken: string) => request('/api/auth/logout', { method: 'POST', json: { refreshToken, deviceId: await getDeviceId() } }),
  me: () => request<Profile>('/api/users/me'),
  updateMe: (data: { fullName: string; language: string; phone?: string }) => request<Profile>('/api/users/me', { method: 'PUT', json: data }),
  updateLanguage: (language: AppLanguage) => request<Profile>('/api/users/me/language', { method: 'PATCH', json: { language } }),
  sessions: () => request<any[]>('/api/users/me/sessions'),
  revokeSession: (id: number) => request(`/api/users/me/sessions/${id}`, { method: 'DELETE' }),
  devices: () => request<UserDeviceList>('/api/users/me/devices'),
  repairDuplicateDevices: repairDuplicateDeviceRecords,
  removeDevice: (id: number) => request(`/api/users/me/devices/${id}`, { method: 'DELETE' }),
  removeOtherDevices: () => request('/api/users/me/devices/others', { method: 'DELETE' }),
  registerDevice: (token: string, platform: 'IOS' | 'ANDROID') => request('/api/users/me/devices', { method: 'POST', json: { token, platform } }),
  venues: (filters: Record<string, unknown> = {}) => request<Page<Venue>>(`/api/venues${query(filters)}`, { auth: false }),
  venue: (id: number) => request<VenueDetail>(`/api/venues/${id}`, { auth: false }),
  availability: (hall: number, month: string) => request<any>(`/api/halls/${hall}/availability${query({ month })}`, { auth: false }),
  catalog: <T = any>(type: string) => request<T>(`/api/catalog/${type}`, { auth: false }),
  reviews: (venue: number, page = 0, size = 20) => request<ReviewPage>(`/api/reviews/venue/${venue}${query({ page, size })}`, { auth: false }),
  reviewEligibility: (bookingId: number) => request<ReviewEligibility>(`/api/reviews/booking/${bookingId}`),
  venueReviewEligibility: (venueId: number) => request<ReviewEligibility>(`/api/reviews/eligibility/venue/${venueId}`),
  createReview: (data: object) => request('/api/reviews', { method: 'POST', json: data }),
  updateReview: (id: number, data: object) => request(`/api/reviews/${id}`, { method: 'PUT', json: data }),
  favorite: (venue: number) => request(`/api/favorites/${venue}`, { method: 'PUT' }),
  unfavorite: (venue: number) => request(`/api/favorites/${venue}`, { method: 'DELETE' }),
  favorites: (page = 0, size = 100) => request<Page<Venue>>(`/api/favorites${query({ page, size })}`),

  bookings: (page = 0) => request<Page<Booking>>(`/api/bookings${query({ page, size: 20 })}`),
  checkoutBooking: (data: object) => request<Payment>('/api/payments/booking-checkout', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey() }, json: data }),
  cancelBooking: (id: number, reason: string) => request<Booking>(`/api/bookings/${id}/cancel`, { method: 'POST', json: { reason } }),
  notifications: (page = 0) => request<any>(`/api/notifications${query({ page, size: 20 })}`),
  unreadNotificationCount: () => request<{ count: number }>('/api/notifications/unread-count'),
  readNotification: (id: number) => request(`/api/notifications/${id}/read`, { method: 'POST' }),
  readAllNotifications: () => request('/api/notifications/read-all', { method: 'POST' }),
  deleteNotifications: (ids: number[]) => request('/api/notifications', { method: 'DELETE', json: ids }),
  notificationPreferences: () => request<import('./types').NotificationPreferences>('/api/notifications/preferences'),
  updateNotificationPreference: (category: import('./types').NotificationPreferenceKey, enabled: boolean) => request<import('./types').NotificationPreferences>(`/api/notifications/preferences/${category}`, { method: 'PUT', json: { enabled } }),

  partnerVenues: (page = 0, size = 20) => request<Page<Venue>>(`/api/partner/venues${query({ page, size })}`),
  partnerVenue: (id: number) => request<VenueDetail>(`/api/partner/venues/${id}`),
  onboarding: (id: number) => request<VenueOnboarding>(`/api/partner/venues/${id}/onboarding`),
  saveLegal: (id: number, data: object) => request<VenueOnboarding>(`/api/partner/venues/${id}/legal`, { method: 'PATCH', json: data }),
  requestCompanyEdit: (id: number, message: string) => request<VenueOnboarding>(`/api/partner/venues/${id}/company-edit-request`, { method: 'POST', json: { message } }),
  agreement: () => request<Agreement>('/api/partner/agreement'),
  acceptAgreement: (id: number, data: object) => request<VenueOnboarding>(`/api/partner/venues/${id}/agreement/accept`, { method: 'POST', json: data }),
  saveMenuPackage: (id: number, data: object, menuId?: number) => request(menuId ? `/api/partner/venues/${id}/menus/${menuId}` : `/api/partner/venues/${id}/menus`, { method: menuId ? 'PUT' : 'POST', json: data }),
  deleteMenuPackage: (id: number, menuId: number) => request(`/api/partner/venues/${id}/menus/${menuId}`, { method: 'DELETE' }),
  submitVenue: (id: number) => request<VenueOnboarding>(`/api/partner/venues/${id}/submit`, { method: 'POST' }),
  saveVenue: (data: object, id?: number) => request<Venue>(id ? `/api/partner/venues/${id}` : '/api/partner/venues', { method: id ? 'PUT' : 'POST', json: data }),
  saveHall: (venueId: number, data: object, hallId?: number) => request<Hall>(hallId ? `/api/partner/halls/${hallId}` : `/api/partner/venues/${venueId}/halls`, { method: hallId ? 'PUT' : 'POST', json: data }),
  blocks: (hallId: number) => request<any[]>(`/api/partner/halls/${hallId}/blocks`),
  block: (hallId: number, data: object) => request(`/api/partner/halls/${hallId}/blocks`, { method: 'POST', json: data }),
  unblock: (hallId: number, blockId: number) => request(`/api/partner/halls/${hallId}/blocks/${blockId}`, { method: 'DELETE' }),
  addService: (venueId: number, data: object) => request(`/api/partner/venues/${venueId}/services`, { method: 'POST', json: data }),
  updateService: (venueId: number, serviceId: number, data: object) => request(`/api/partner/venues/${venueId}/services/${serviceId}`, { method: 'PUT', json: data }),
  deleteService: (venueId: number, serviceId: number) => request(`/api/partner/venues/${venueId}/services/${serviceId}`, { method: 'DELETE' }),
  setAmenities: (venueId: number, ids: number[], customNames: string[] = []) => request(`/api/partner/venues/${venueId}/amenity-selection`, { method: 'PUT', json: { ids, customNames } }),
  removeMedia: (venueId: number, mediaId: number) => request(`/api/partner/venues/${venueId}/media/${mediaId}`, { method: 'DELETE' }),
  uploadMedia: async (venueId: number, asset: { uri: string; mimeType?: string | null; fileName?: string | null }, hallId?: number) => {
    const form = new FormData();
    form.append('file', new File(asset.uri));
    return request(`/api/partner/venues/${venueId}/media/upload${query({ hallId })}`, { method: 'POST', body: form, timeoutMs: 60_000 });
  },
  uploadVenueDocument: async (venueId: number, documentType: 'COMPANY' | 'IDENTITY', asset: { uri: string }) => {
    const form = new FormData();
    form.append('file', new File(asset.uri));
    return request<{ url: string }>(`/api/partner/venues/${venueId}/documents/${documentType}/upload`, { method: 'POST', body: form, timeoutMs: 60_000 });
  },
  partnerBookings: (venueId: number, filters: { month?: string; hallId?: number; menuPackageId?: number; status?: string; page?: number; size?: number } = {}) => request<Page<Booking>>(`/api/partner/venues/${venueId}/bookings${query({ ...filters, page: filters.page ?? 0, size: filters.size ?? 100 })}`),
  pendingPartnerBookings: (page = 0, size = 100) => request<Page<Booking>>(`/api/partner/bookings/pending${query({ page, size })}`),
  partnerBooking: (bookingId: number) => request<Booking>(`/api/partner/bookings/${bookingId}`),
  approveBooking: (bookingId: number) => request<Booking>(`/api/partner/bookings/${bookingId}/approve`, { method: 'POST' }),
  rejectBooking: (bookingId: number, reason: string) => request<Booking>(`/api/partner/bookings/${bookingId}/reject`, { method: 'POST', json: { reason } }),
  completeBooking: (bookingId: number) => request<Booking>(`/api/partner/bookings/${bookingId}/complete`, { method: 'POST' }),
  partnerReport: (venueId: number, month?: string) => request<any>(`/api/partner/venues/${venueId}/report${query({ month })}`),
  replyReview: (id: number, text: string) => request(`/api/partner/reviews/${id}/reply`, { method: 'PUT', json: { text } }),
  reportReview: (id: number, reason: string) => request(`/api/partner/reviews/${id}/report`, { method: 'POST', json: { reason } }),

};
