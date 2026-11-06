import { Stack } from 'expo-router';
import { PartnerVenueProvider } from '@/partner-context';

export default function PartnerLayout() {
  return <PartnerVenueProvider><Stack screenOptions={{ gestureEnabled: true, headerShown: false }}/></PartnerVenueProvider>;
}
