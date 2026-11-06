import * as SecureStore from 'expo-secure-store';

const claimed = new Set<number>();

function key(userId: number) {
  return `notification.permission.explained.${userId}`;
}

function bookingReturnKey(userId: number) {
  return `notification.permission.after-booking.${userId}`;
}

export async function claimNotificationPermissionExplanation(userId: number) {
  if (claimed.has(userId)) return false;
  const storageKey = key(userId);
  const wasExplained = await SecureStore.getItemAsync(storageKey).catch(() => null);
  if (wasExplained) return false;
  claimed.add(userId);
  await SecureStore.setItemAsync(storageKey, '1').catch(() => undefined);
  return true;
}

export async function markNotificationExplanationAfterBooking(userId: number) {
  await SecureStore.setItemAsync(bookingReturnKey(userId), '1').catch(() => undefined);
}

export async function consumeNotificationExplanationAfterBooking(userId: number) {
  const storageKey = bookingReturnKey(userId);
  const shouldExplain = await SecureStore.getItemAsync(storageKey).catch(() => null);
  if (!shouldExplain) return false;
  await SecureStore.deleteItemAsync(storageKey).catch(() => undefined);
  return true;
}
