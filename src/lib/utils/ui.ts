/**
 * UI utilities untuk komponen Svelte
 */
import { NOTIF } from '$lib/constants/ui';

// Toast management utility to reduce code duplication
export function createToastManager() {
	// Create reactive stores for toast state
	const toastState = {
		show: false,
		message: '',
		type: 'success' as 'success' | 'error' | 'warning' | 'info',
		timeout: null as number | null
	};

	function showToastNotification(
		message: string,
		type: 'success' | 'error' | 'warning' | 'info' = 'success',
		duration: number = NOTIF.TOAST_MS
	) {
		toastState.message = message;
		toastState.type = type;
		toastState.show = true;

		// Clear existing timeout
		if (toastState.timeout) {
			clearTimeout(toastState.timeout);
		}

		// Auto hide after duration
		toastState.timeout = Number(
			setTimeout(() => {
				toastState.show = false;
				toastState.timeout = null;
			}, duration)
		);
	}

	function hideToast() {
		toastState.show = false;
		if (toastState.timeout) {
			clearTimeout(toastState.timeout);
			toastState.timeout = null;
		}
	}

	// Return an object with reactive properties
	return {
		get showToast() {
			return toastState.show;
		},
		get toastMessage() {
			return toastState.message;
		},
		get toastType() {
			return toastState.type;
		},
		showToastNotification,
		hideToast
	};
}
