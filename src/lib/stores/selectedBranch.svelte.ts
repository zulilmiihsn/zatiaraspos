type BranchType = 'samarinda' | 'berau' | 'Balikpapan' | 'samarinda2' | 'balikpapan2';

class BranchState {
	#value = $state<BranchType>('samarinda');

	constructor() {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('selectedBranch') as BranchType | null;
			if (
				saved &&
				['berau', 'samarinda', 'Balikpapan', 'samarinda2', 'balikpapan2'].includes(saved)
			) {
				this.#value = saved;
			}
		}
	}

	get value(): BranchType {
		return this.#value;
	}

	set value(v: BranchType) {
		this.#value = v;
		if (typeof window !== 'undefined') {
			localStorage.setItem('selectedBranch', v);
		}
	}
}

export const selectedBranch = new BranchState();
