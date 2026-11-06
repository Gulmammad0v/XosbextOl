import * as SecureStore from 'expo-secure-store';
import type { Booking } from './types';
import { translate } from './i18n';

type WeddingSubtask = {
  id: string;
  title: string;
  titleKey?: string;
  done: boolean;
};

export type WeddingTask = WeddingSubtask & {
  children: WeddingSubtask[];
};

const storageKey = (bookingId: number) => `wedding.tasks.${bookingId}`;

function createDefaultWeddingTasks(booking: Booking): WeddingTask[] {
  const task = (id: string, titleKey: string, done = false): WeddingTask => ({ id, titleKey, title: translate(titleKey), done, children: [] });
  return [
    task('venue', 'wedding.defaultTasks.venue', !!(booking.venueName || booking.hallName) && booking.paidAmount > 0),
    task('date', 'wedding.defaultTasks.date', !!booking.eventDate),
    task('guests', 'wedding.defaultTasks.guests', booking.guestCount > 0),
    task('media', 'wedding.defaultTasks.media'),
    task('decor', 'wedding.defaultTasks.decor'),
    task('music', 'wedding.defaultTasks.music'),
    task('invitations', 'wedding.defaultTasks.invitations')
  ];
}

export async function loadWeddingTasks(booking: Booking) {
  try {
    const stored = await SecureStore.getItemAsync(storageKey(booking.id));
    if (!stored) return createDefaultWeddingTasks(booking);
    const parsed = JSON.parse(stored) as WeddingTask[];
    if (!Array.isArray(parsed)) return createDefaultWeddingTasks(booking);
    const defaultIds = new Set(['venue', 'date', 'guests', 'media', 'decor', 'music', 'invitations']);
    return parsed.filter(task => task && task.id !== 'payment' && typeof task.id === 'string' && typeof task.title === 'string').map(task => ({
      ...task,
      titleKey: defaultIds.has(task.id) ? `wedding.defaultTasks.${task.id}` : task.titleKey,
      done: !!task.done,
      children: Array.isArray(task.children) ? task.children.filter(child => child && typeof child.id === 'string' && typeof child.title === 'string').map(child => ({ ...child, done: !!child.done })) : []
    }));
  } catch {
    return createDefaultWeddingTasks(booking);
  }
}

export async function saveWeddingTasks(bookingId: number, tasks: WeddingTask[]) {
  await SecureStore.setItemAsync(storageKey(bookingId), JSON.stringify(tasks));
}

export function weddingTaskStats(tasks: WeddingTask[]) {
  const all = tasks.flatMap(task => [task, ...task.children]);
  return { done: all.filter(task => task.done).length, total: all.length };
}
