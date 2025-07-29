import { writable } from 'svelte/store';

interface SecuritySettings {
  pin: string | null;
  lockedPages: string[] | null;
}

export const securitySettings = writable<SecuritySettings | null>(null);

export function setSecuritySettings(settings: SecuritySettings) {
  securitySettings.set(settings);
}

export function clearSecuritySettings() {
  securitySettings.set(null);
}