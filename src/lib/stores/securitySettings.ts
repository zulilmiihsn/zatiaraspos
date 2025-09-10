import { writable } from 'svelte/store';
import { browser } from '$app/environment';

interface SecuritySettings {
	pin: string | null;
	lockedPages: string[] | null;
}

// Initialize store with data from localStorage if available
const initialValue = browser ? (() => {
	try {
		const saved = localStorage.getItem('zatiaras_security_settings');
		return saved ? JSON.parse(saved) : null;
	} catch (e) {
		console.error('Error parsing security settings from localStorage:', e);
		return null;
	}
})() : null;

export const securitySettings = writable<SecuritySettings | null>(initialValue);

export function setSecuritySettings(settings: SecuritySettings) {
	securitySettings.set(settings);
	// Persist to localStorage
	if (browser) {
		try {
			localStorage.setItem('zatiaras_security_settings', JSON.stringify(settings));
		} catch (e) {
			console.error('Error saving security settings to localStorage:', e);
		}
	}
}

export function clearSecuritySettings() {
	securitySettings.set(null);
	// Clear from localStorage
	if (browser) {
		try {
			localStorage.removeItem('zatiaras_security_settings');
		} catch (e) {
			console.error('Error clearing security settings from localStorage:', e);
		}
	}
}
