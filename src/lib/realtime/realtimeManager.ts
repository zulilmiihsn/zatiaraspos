import { browser } from '$app/environment';
import { subscribeToRealtimeTable } from '$lib/realtime/durableObjectClient';
import { cacheOrchestrator } from '$lib/utils/cacheOrchestrator';

class RealtimeManager {
	private unsubFns = new Map<string, (() => void) | null>();
	private pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
	private latestPayload = new Map<string, Record<string, unknown>>();

	subscribe(table: string, callback: (payload: Record<string, unknown>) => void) {
		if (this.unsubFns.has(table)) this.unsubscribe(table);

		if (!browser) return;

		const unsub = subscribeToRealtimeTable(table, (payload) => {
			this.latestPayload.set(table, payload);
			if (this.pendingTimers.has(table)) return;

			const id = setTimeout(async () => {
				this.pendingTimers.delete(table);
				const latest = this.latestPayload.get(table);
				this.latestPayload.delete(table);
				await cacheOrchestrator.invalidateCacheOnChange(table);
				if (latest !== undefined) callback(latest);
			}, 250);
			this.pendingTimers.set(table, id);
		});

		this.unsubFns.set(table, unsub);
	}

	unsubscribe(table: string) {
		const timer = this.pendingTimers.get(table);
		if (timer) {
			clearTimeout(timer);
			this.pendingTimers.delete(table);
		}
		this.latestPayload.delete(table);
		const unsub = this.unsubFns.get(table);
		if (unsub) {
			unsub();
			this.unsubFns.delete(table);
		}
	}

	unsubscribeAll() {
		for (const id of this.pendingTimers.values()) clearTimeout(id);
		this.pendingTimers.clear();
		this.latestPayload.clear();
		for (const unsub of this.unsubFns.values()) unsub?.();
		this.unsubFns.clear();
	}
}

export const realtimeManager = new RealtimeManager();

if (browser) {
	window.addEventListener('beforeunload', () => realtimeManager.unsubscribeAll());
}
