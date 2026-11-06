import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';

type Selection = { venueId?: number; hallId?: number; venueName?: string };
type PartnerVenueValue = Selection & {
  select: (selection: Selection) => void;
  resolve: () => Promise<Selection>;
};
const PartnerVenueContext = createContext<PartnerVenueValue | null>(null);

export function PartnerVenueProvider({ children }: PropsWithChildren) {
  const [selection, setSelection] = useState<Selection>({});
  const select = useCallback((next: Selection) => setSelection(current => {
    const venueChanged = next.venueId != null && next.venueId !== current.venueId;
    return { ...current, ...next, ...(venueChanged && next.hallId == null ? { hallId: undefined } : {}) };
  }), []);
  const resolve = useCallback(async () => {
    if (selection.venueId) return selection;
    const page = await api.partnerVenues(0, 1);
    const venue = page.content?.[0];
    if (!venue) return {};
    const detail = await api.partnerVenue(venue.id);
    const next = { venueId: venue.id, venueName: venue.name, hallId: detail.halls[0]?.id };
    setSelection(current => current.venueId ? current : next);
    return next;
  }, [selection]);
  useEffect(() => { void resolve().catch(() => undefined); }, [resolve]);
  const value = useMemo(() => ({ ...selection, select, resolve }), [resolve, select, selection]);
  return <PartnerVenueContext.Provider value={value}>{children}</PartnerVenueContext.Provider>;
}

export function usePartnerVenue() {
  const value = useContext(PartnerVenueContext);
  if (!value) throw new Error('usePartnerVenue must be used inside PartnerVenueProvider');
  return value;
}
