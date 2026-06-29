import { fetchWithCsrfRetry } from '$lib/utils/csrf';

export async function readImageFile(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result || ''));
		reader.onerror = () => reject(reader.error || new Error('Gagal membaca gambar'));
		reader.readAsDataURL(file);
	});
}

export async function uploadMenuImageFromDataUrl(
	dataUrl: string,
	menuId: string | number
): Promise<string> {
	const blob = await (await fetch(dataUrl)).blob();
	const file = new File([blob], `menu-${menuId}-${Date.now()}.jpg`, { type: 'image/jpeg' });
	const formData = new FormData();
	formData.append('file', file);
	const response = await fetchWithCsrfRetry('/api/upload', { method: 'POST', body: formData });
	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(error.error || 'Gagal mengunggah gambar');
	}
	const data = await response.json();
	return data.url;
}

export async function deleteMenuImage(imageUrl?: string): Promise<void> {
	if (!imageUrl) return;
	const filename = imageUrl.includes('/produk/')
		? imageUrl.split('/produk/').pop()
		: imageUrl.split('/').pop();
	if (!filename) return;
	await fetchWithCsrfRetry('/api/upload', {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ key: `produk/${filename}` })
	});
}
