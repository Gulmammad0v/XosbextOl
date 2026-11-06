export type Role = 'CUSTOMER' | 'VENUE_OWNER' | 'ADMIN';
export type BookingEventType = 'WEDDING' | 'BIRTHDAY' | 'SOLDIER_GATHERING' | 'PRIVATE_EVENT';

export interface Tokens { accessToken: string; refreshToken: string; expiresIn: number; tokenType: string }
export interface Profile { id: number; email: string; phone?: string; fullName: string; firstName?: string; lastName?: string; birthDate?: string; avatarUrl?: string; role: Role; language: 'az' | 'ru' | 'en'; hasPassword: boolean; createdAt?: string }
export interface UserDevice { id: number; deviceName: string; platform: 'IOS' | 'ANDROID'; osVersion?: string; appVersion?: string; lastActiveAt: string; lastCity?: string; status: 'ACTIVE' | 'REVOKED'; notificationsEnabled: boolean; current: boolean }
export interface UserDeviceList { devices: UserDevice[]; activeCount: number; limit: number }
export interface DeviceLimitDetails { code: 'AUTH_DEVICE_LIMIT_REACHED'; message: string; limitToken: string; deviceLimit: number; devices: UserDevice[] }
export interface Page<T> { content: T[]; page: number; size: number; totalElements: number; totalPages: number }
export interface Venue { id: number; name: string; slug: string; address: string; city?: string; latitude: number; longitude: number; coverImageUrl?: string; rating: number; ratingAvg?: number; rating_avg?: number; reviewCount: number; capacityMin?: number; capacityMax?: number; minPricePerPerson?: number; status: string; changeReviewStatus?: string; companyEditStatus?: string }
export interface Hall { id: number; name: string; capacityMin: number; capacityMax: number; pricePerPerson: number; depositPercent: number; active: boolean }
export interface Media { id: number; hall_id?: number; hallId?: number; type: string; url: string; thumb_url?: string; thumbUrl?: string; sort_order?: number }
export interface ExtraService { id: number; name: string; description?: string; price: number; price_type?: string; priceType?: string; active: boolean }
export interface Amenity { id: number; code?: string; name?: string; nameAz?: string; nameEn?: string; nameRu?: string; name_az?: string; name_en?: string; name_ru?: string }
export interface MenuItem { id: number; name: string; description?: string; seasonal: boolean; customizable: boolean; additionalPricePerPerson: number }
export interface MenuCategory { id: number; name: string; sortOrder: number; defaultCustomizable?: boolean; defaultPricePerPerson?: number; items: MenuItem[] }
export interface MenuPackage { id: number; name: string; description?: string; pricePerPerson: number; popular: boolean; tier: number; categories: MenuCategory[] }
export interface MenuItemTemplate { id: number; categoryName: string; categorySortOrder: number; itemName: string; itemSortOrder: number; seasonal: boolean }
export interface BookingMenuChange { itemId: number; name: string; categoryName?: string; action: 'ADDED' | 'REMOVED'; pricePerPerson: number }
export interface BookingExtraService { serviceId: number; name: string; quantity: number; unitPrice: number; totalPrice: number }
export interface VenueDetail { venue: Venue; description?: string; halls: Hall[]; media: Media[]; amenities: Amenity[]; services: ExtraService[]; menus: MenuPackage[] }
export interface Booking { id: number; bookingNumber: string; hallId: number; userId: number; venueName?: string; hallName?: string; venuePhone?: string; eventDate: string; guestCount: number; eventType?: BookingEventType; status: string; hallPrice: number; servicesPrice: number; discountAmount: number; totalPrice: number; depositAmount: number; paidAmount: number; expiresAt?: string; customerNote?: string; menuPackageId?: number; menuName?: string; menuCustomizationPrice?: number; removedMenuItems?: string[]; addedMenuItems?: string[]; menuCategories?: MenuCategory[]; menuChanges?: BookingMenuChange[]; customerName?: string; customerEmail?: string; customerPhone?: string; extraServices?: BookingExtraService[]; createdAt?: string; cancelReason?: string }
export interface Payment { id: number; bookingId?: number; provider: string; transactionId?: string; checkoutUrl?: string; amount: number; currency: string; status: string }
export interface Notification { id: number; type?: string; title: string; body: string; deepLink?: string; actionPath?: string; read?: boolean; readAt?: string; is_read?: boolean; isRead?: boolean; createdAt?: string; created_at?: string }
export type NotificationPreferenceKey = 'REMINDER' | 'RESPONSE_REMINDER' | 'REVIEW' | 'PROMO';
export type NotificationPreferences = Partial<Record<NotificationPreferenceKey, boolean>>;
export interface Review { id: number; bookingId: number; userName?: string; user_name?: string; rating: number; ratingFood?: number; ratingService?: number; ratingHall?: number; ratingValue?: number; comment?: string; ownerReply?: string; reply?: string; owner_reply?: string; status?: string; moderationStatus?: string; createdAt?: string; created_at?: string; editedAt?: string }
export interface ReviewSummary { ratingAvg: number; ratingFood: number | null; ratingService: number | null; ratingHall: number | null; ratingValue: number | null; count: number; distribution: Record<string, number> }
export interface ReviewPage extends Page<Review> { summary: ReviewSummary }
export interface ReviewEligibility { bookingId: number; venueId: number; venueName: string; coverImageUrl?: string; eventDate: string; guestCount: number; eligible: boolean; opensOn: string; closesOn: string; editable: boolean; editableUntil?: string; review?: Review }
export interface OnboardingRequirement { code: string; label: string; complete: boolean }
export interface VenueChange { section: string; field: string; oldValue: string; newValue: string; changeType?: string }
export interface VenueOnboarding { venueId: number; ownerFullName?: string; ownerEmail?: string; ownerPhone?: string; completionPercent: number; status: string; requirements: OnboardingRequirement[]; rejectionReason?: string; criticalChangeStatus?: string; criticalChangeReason?: string; changes?: VenueChange[]; pendingName?: string; pendingAddress?: string; pendingCity?: string; pendingLatitude?: number; pendingLongitude?: number; legalName?: string; taxId?: string; finCode?: string; companyDocumentUrl?: string; ownerIdentityDocumentUrl?: string; agreementVersion?: string; agreementAcceptedAt?: string; agreementSignedBy?: string; companyEditStatus?: string; companyEditRequestMessage?: string; companyEditRequestedAt?: string; companyEditAllowedUntil?: string; companyEditUsedAt?: string; companyEditDecisionReason?: string; frozen: boolean; visible: boolean }
export interface Agreement { version: string; title: string; content: string; testDocument: boolean }

const labelKeys = [
  'WEDDING', 'BIRTHDAY', 'SOLDIER_GATHERING', 'PRIVATE_EVENT',
  'CUSTOMER', 'VENUE_OWNER', 'ADMIN', 'PENDING', 'DRAFT', 'CHANGES_PENDING',
  'ACTIVE', 'SUSPENDED', 'REJECTED', 'PENDING_APPROVAL', 'CONFIRMED', 'COMPLETED', 'CANCELLED',
  'REFUNDED', 'SUCCESS', 'FAILED', 'BLOCKED', 'DELETED', 'FIXED', 'PER_PERSON', 'VISIBLE', 'HIDDEN',
  'REAPPROVAL_PENDING', 'REAPPROVAL_APPROVED', 'REAPPROVAL_REJECTED',
] as const;

export const labels: Record<string, string> = Object.fromEntries(labelKeys.map(key => [key, key]));
