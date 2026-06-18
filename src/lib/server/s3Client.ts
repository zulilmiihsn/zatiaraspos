import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { env } from '$env/dynamic/private';

/**
 * Creates an S3Client configured for Cloudflare R2.
 * Must only be used in server-side code (+server.ts).
 *
 * Required env vars:
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   R2_PUBLIC_URL  (e.g. https://pub-xxx.r2.dev)
 */
export const createR2Client = () => {
	if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
		throw new Error(
			'R2 credentials are not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.'
		);
	}

	return new S3Client({
		region: 'auto',
		endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: env.R2_ACCESS_KEY_ID,
			secretAccessKey: env.R2_SECRET_ACCESS_KEY
		}
	});
};

/**
 * Upload a file buffer to R2 and return the public URL.
 * @param key   The object key (e.g. 'produk/uuid.webp')
 * @param body  File content as ArrayBuffer | Uint8Array
 * @param contentType  MIME type (e.g. 'image/webp')
 */
export const uploadToR2 = async (
	key: string,
	body: ArrayBuffer | Uint8Array,
	contentType: string,
	bucketBinding?: any
): Promise<string> => {
	if (bucketBinding) {
		await bucketBinding.put(key, body, {
			httpMetadata: { contentType }
		});
		const publicUrl = env.R2_PUBLIC_URL || '';
		return publicUrl ? `${publicUrl}/${key}` : `/api/upload?key=${encodeURIComponent(key)}`;
	}

	const client = createR2Client();
	const bucket = env.R2_BUCKET_NAME || 'zatiaras-assets';
	const publicUrl = env.R2_PUBLIC_URL || '';

	await client.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: new Uint8Array(body),
			ContentType: contentType
		})
	);

	return `${publicUrl}/${key}`;
};

/**
 * Delete an object from R2 by key.
 */
export const deleteFromR2 = async (key: string, bucketBinding?: any): Promise<void> => {
	if (bucketBinding) {
		await bucketBinding.delete(key);
		return;
	}

	const client = createR2Client();
	const bucket = env.R2_BUCKET_NAME || 'zatiaras-assets';

	await client.send(
		new DeleteObjectCommand({
			Bucket: bucket,
			Key: key
		})
	);
};
