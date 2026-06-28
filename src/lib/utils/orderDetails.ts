type OrderCustomization = {
	gula?: string | null;
	es?: string | null;
	catatan?: string | null;
};

const OPTION_LABELS: Record<string, Record<string, string>> = {
	gula: {
		no: 'Tanpa Gula',
		less: 'Sedikit Gula'
	},
	es: {
		no: 'Tanpa Es',
		less: 'Sedikit Es'
	}
};

function formatOption(kind: 'gula' | 'es', value?: string | null): string | null {
	if (!value || value === 'normal') return null;
	return OPTION_LABELS[kind][value] || value;
}

export function formatOrderDetails(item: OrderCustomization): string {
	return [
		formatOption('gula', item.gula),
		formatOption('es', item.es),
		item.catatan?.trim() || null
	]
		.filter((value): value is string => Boolean(value))
		.join(', ');
}
