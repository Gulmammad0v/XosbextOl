import { createContext, createElement, PropsWithChildren, useContext } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

export const colors = {
  ink: '#252421',
  muted: '#746F67',
  cream: '#F8F5EF',
  paper: '#FFFFFF',
  line: '#E9E1D4',
  brand: '#946B24',
  brandDark: '#946B24',
  gold: '#B78B3C',
  goldLight: '#DFC797',
  success: '#627044',
  danger: '#A44A46',
  softBrand: '#F2EBDD',
  softGold: '#F4EDDE',
  shadow: '#3A2B16'
};

const AndroidDensitySuppressedContext = createContext(false);

export function AndroidDensitySuppressed({ children }: PropsWithChildren) {
  return createElement(AndroidDensitySuppressedContext.Provider, { value: true }, children);
}

export function useCompactAndroidLayout() {
  const suppressed = useContext(AndroidDensitySuppressedContext);
  const { height, fontScale } = useWindowDimensions();
  return !suppressed && Platform.OS === 'android' && (height < 720 || fontScale > 1.15);
}

export function useAndroidContentScale() {
  const { height, fontScale } = useWindowDimensions();
  return Platform.OS === 'android' && (height < 720 || fontScale > 1.15) ? 0.84 : 1;
}
