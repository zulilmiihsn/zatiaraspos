import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { NAV_ITEMS } from '$lib/constants/navigation';

export interface SwipeNavigationHandlers {
	handleTouchStart: (e: TouchEvent) => void;
	handleTouchMove: (e: TouchEvent) => void;
	handleTouchEnd: (e: TouchEvent) => void;
	handleGlobalClick: (e: Event) => void;
}

export function createSwipeNavigation(currentIndex: number): SwipeNavigationHandlers {
	let touchStartX = 0;
	let touchStartY = 0;
	let touchEndX = 0;
	let touchEndY = 0;
	let isTouchDevice = false;
	let clickBlocked = false;
	let isSwiping = false;

	if (browser) {
		isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
	}

	function handleTouchStart(e: TouchEvent) {
		if (!isTouchDevice) return;
		touchStartX = e.changedTouches[0].screenX;
		touchStartY = e.changedTouches[0].screenY;
		isSwiping = false;
		clickBlocked = false;
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isTouchDevice) return;
		touchEndX = e.changedTouches[0].screenX;
		touchEndY = e.changedTouches[0].screenY;

		if (!isSwiping) {
			const deltaX = Math.abs(touchEndX - touchStartX);
			const deltaY = Math.abs(touchEndY - touchStartY);
			const viewportWidth = window.innerWidth;
			const swipeThreshold = viewportWidth * 0.25;
			if (deltaX > swipeThreshold && deltaX > deltaY) {
				isSwiping = true;
				clickBlocked = true;
			}
		}
	}

	function handleTouchEnd(e: TouchEvent) {
		if (!isTouchDevice) return;

		// Don't handle touch on interactive elements
		const target = e.target as HTMLElement;
		if (
			target.tagName === 'BUTTON' ||
			target.tagName === 'INPUT' ||
			target.tagName === 'A' ||
			target.closest('button') ||
			target.closest('input') ||
			target.closest('a') ||
			target.closest('.no-swipe') // Custom class to disable swipe on specific areas
		) {
			return;
		}

		if (browser && isSwiping) {
			const deltaX = touchEndX - touchStartX;
			const viewportWidth = window.innerWidth;
			const swipeThreshold = viewportWidth * 0.25;

			if (Math.abs(deltaX) > swipeThreshold) {
				if (deltaX > 0 && currentIndex > 0) {
					// Swipe right - go to previous tab
					goto(NAV_ITEMS[currentIndex - 1].path);
				} else if (deltaX < 0 && currentIndex < NAV_ITEMS.length - 1) {
					// Swipe left - go to next tab
					goto(NAV_ITEMS[currentIndex + 1].path);
				}
			}

			// Block any subsequent click events
			setTimeout(() => {
				clickBlocked = false;
			}, 100);
		}
	}

	function handleGlobalClick(e: Event) {
		if (clickBlocked) {
			e.preventDefault();
			e.stopPropagation();
			return;
		}
	}

	return {
		handleTouchStart,
		handleTouchMove,
		handleTouchEnd,
		handleGlobalClick
	};
}
