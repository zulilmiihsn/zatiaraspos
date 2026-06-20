import { json } from '@sveltejs/kit';
import { uploadToR2, deleteFromR2 } from '$lib/server/s3Client';
import { v4 as uuidv4 } from 'uuid';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function GET({ url, platform }) {
	const key = url.searchParams.get('key');
	const bucket = platform?.env?.STORAGE;
	if (!key || !bucket) {
		return json({ error: 'Not found' }, { status: 404 });
	}

	const object = await bucket.get(key);
	if (!object) {
		return json({ error: 'Not found' }, { status: 404 });
	}

	return new Response(object.body as unknown as ReadableStream, {
		headers: {
			'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
}

export async function POST({ request, platform }) {
	try {
		const formData = await request.formData();
		const file = formData.get('file') as File | null;

		if (!file) {
			return json({ error: 'No file provided' }, { status: 400 });
		}

		if (!ALLOWED_TYPES.includes(file.type)) {
			return json({ error: 'Invalid file type. Allowed: jpg, png, webp' }, { status: 400 });
		}

		if (file.size > MAX_SIZE_BYTES) {
			return json({ error: 'File too large. Max 5MB.' }, { status: 400 });
		}

		const bucket = platform?.env?.STORAGE;
		if (!bucket) {
			return json({ error: 'Storage unavailable' }, { status: 503 });
		}

		const ext = file.name.split('.').pop() ?? 'webp';
		const key = `produk/${uuidv4()}.${ext}`;
		const buffer = await file.arrayBuffer();

		const publicUrl = await uploadToR2(key, buffer, file.type, bucket);

		return json({ url: publicUrl, key });
	} catch (err) {
		console.error('[upload] Error:', err);
		return json({ error: 'Upload failed' }, { status: 500 });
	}
}

export async function DELETE({ request, platform }) {
	try {
		const { key } = (await request.json()) as { key: string };

		if (!key) {
			return json({ error: 'No key provided' }, { status: 400 });
		}

		const bucket = platform?.env?.STORAGE;
		if (!bucket) {
			return json({ error: 'Storage unavailable' }, { status: 503 });
		}

		await deleteFromR2(key, bucket);
		return json({ success: true });
	} catch (err) {
		console.error('[upload] Delete error:', err);
		return json({ error: 'Delete failed' }, { status: 500 });
	}
}
