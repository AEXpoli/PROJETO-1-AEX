import type { ExpoConfig } from 'expo/config';
const config: ExpoConfig = {
  name: 'AEX',
  slug: 'aex',
  version: '0.1.0',
  scheme: 'aex',
  platforms: ['ios', 'android'],
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  plugins: ['expo-router', 'expo-secure-store'],
};
export default config;
