import * as pako from 'pako';
import { Base64 } from 'js-base64';

function padLine(left: string, right: string, width = 32): string {
	left = left.trim();
	right = right.trim();
	const spaceNeeded = width - left.length - right.length;
	if (spaceNeeded > 0) {
		return left + ' '.repeat(spaceNeeded) + right;
	}
	return left + ' ' + right;
}

function centerLine(text: string, width = 32): string {
	text = text.trim();
	if (!text) return '';
	if (text.length >= width) return text;
	const leftPad = Math.floor((width - text.length) / 2);
	return ' '.repeat(leftPad) + text;
}

export function convertHtmlToReceiptText(htmlString: string, width = 32): string {
	if (typeof window === 'undefined') return htmlString;
	const parser = new DOMParser();
	const doc = parser.parseFromString(htmlString, 'text/html');
	const lines: string[] = [];

	const body = doc.body;
	if (!body) return htmlString;

	for (const child of Array.from(body.children)) {
		const tagName = child.tagName.toLowerCase();
		const style = child.getAttribute('style') || '';
		const hasBorder = style.includes('border-bottom');

		if (tagName === 'div') {
			const isCenter = style.includes('text-align:center') || style.includes('text-align: center');
			const isFlex = style.includes('display:flex') || style.includes('display: flex');

			if (isFlex) {
				const subDivs = Array.from(child.children).map((c) => c.textContent?.trim() || '');
				if (subDivs.length >= 2) {
					lines.push(padLine(subDivs[0], subDivs[1], width));
				} else if (subDivs.length === 1) {
					lines.push(subDivs[0]);
				}
			} else {
				const innerHtml = child.innerHTML;
				const parts = innerHtml.split(/<br\s*\/?>|\n/i);
				for (const part of parts) {
					const temp = document.createElement('div');
					temp.innerHTML = part;
					let text = temp.textContent?.trim() || '';
					if (!text) continue;

					if (
						style.includes('text-transform:uppercase') ||
						style.includes('text-transform: uppercase')
					) {
						text = text.toUpperCase();
					}

					if (isCenter) {
						lines.push(centerLine(text, width));
					} else {
						lines.push(text);
					}
				}
			}
		} else if (tagName === 'table') {
			const rows = Array.from(child.querySelectorAll('tr'));
			for (const row of rows) {
				const tds = Array.from(row.querySelectorAll('td'));
				if (tds.length === 2) {
					const left = tds[0].textContent?.trim() || '';
					const right = tds[1].textContent?.trim() || '';
					lines.push(padLine(left, right, width));
				} else if (tds.length === 1) {
					const text = tds[0].textContent?.trim() || '';
					if (text) lines.push(text);
				}
			}
		}

		if (hasBorder) {
			lines.push('-'.repeat(width));
		}
	}

	return lines.join('\n');
}

export function executePrint(intentUrl: string) {
	// Cek apakah ini benar-benar Windows PC
	const isWindows = /windows/i.test(navigator.userAgent);

	if (!isWindows) {
		// Jika BUKAN Windows (berarti HP/Tablet Android, iPad, atau Desktop Mode di Tablet),
		// selalu gunakan metode Intent.
		window.location.href = intentUrl;
		return;
	}

	// --- Khusus Windows PC / Desktop ---
	const match = intentUrl.match(/S\.content=([^;]+)/);
	const rawBase64 = match ? match[1] : intentUrl;

	try {
		const byteArray = Base64.toUint8Array(rawBase64);
		const uncompressed = pako.ungzip(byteArray, { to: 'string' });
		const parsed = JSON.parse(uncompressed);
		const htmlContent = Array.isArray(parsed) ? parsed[0] : parsed;

		if (typeof htmlContent === 'string' && htmlContent.includes('<html')) {
			const plainText = convertHtmlToReceiptText(htmlContent, 32);
			const newGzip = pako.gzip(JSON.stringify([plainText]));
			const newBase64 = Base64.fromUint8Array(newGzip);
			window.location.href = `zatiarasprint://${newBase64}`;
			return;
		}
	} catch (e) {
		console.warn('Failed to parse HTML for Windows printing, using raw base64:', e);
	}

	window.location.href = `zatiarasprint://${rawBase64}`;
}
