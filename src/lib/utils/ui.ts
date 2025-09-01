/**
 * UI utilities untuk komponen Svelte
 */

// Global declaration untuk window.scrollToSmooth
declare global {
	interface Window {
		scrollToSmooth: (targetY: number, duration?: number) => void;
	}
}

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
		duration: number = 3000
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

// Smooth scroll utility
export function createSmoothScroll() {
	// Helper scrollToSmooth: scroll ke posisi Y dengan animasi smooth dan durasi custom (default 600ms, slowmo sedikit)
	if (typeof window !== 'undefined') {
		window.scrollToSmooth = function (targetY: number, duration: number = 600) {
			const startY = window.scrollY;
			const diff = targetY - startY;
			let start: number | undefined;
			function step(timestamp: number) {
				if (start === undefined) start = timestamp;
				const elapsed = timestamp - start;
				const progress = Math.min(elapsed / duration, 1);
				const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
				window.scrollTo(0, startY + diff * ease);
				if (progress < 1) {
					window.requestAnimationFrame(step);
				}
			}
			window.requestAnimationFrame(step);
		};
	}

	return {
		scrollToSmooth: (targetY: number, duration?: number) => {
			if (typeof window !== 'undefined' && window.scrollToSmooth) {
				window.scrollToSmooth(targetY, duration);
			}
		}
	};
}
