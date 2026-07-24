/**
 * Utility functions for the video player interface
 */

/**
 * Slugify a string - convert to URL-safe format
 */
export function slugify(text: string): string {
	return text
		.toString()
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '-')
		.replace(/[^\w\-]+/g, '')
		.replace(/\-\-+/g, '-')
		.replace(/^-+/, '')
		.replace(/-+$/, '');
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
	if (!bytes) return '';
	const sizes = ['B', 'kB', 'MB', 'GB'];
	if (bytes === 0) return '0 B';
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Normalize API base URL to ensure it has protocol and host
 */
export function normalizeApiBaseUrl(api: any, fallback: string = window.location.origin + '/api'): string {
	let baseURL = api?.defaults?.baseURL || api?.url || fallback;
	
	// Ensure we have a full URL with protocol and host
	if (baseURL.startsWith('//')) {
		// Protocol-relative URL - add current protocol
		baseURL = window.location.protocol + baseURL;
	} else if (baseURL.startsWith('/')) {
		// Relative URL - add current origin
		baseURL = window.location.origin + baseURL;
	} else if (!baseURL.startsWith('http://') && !baseURL.startsWith('https://')) {
		// No protocol - add current origin
		baseURL = window.location.origin + (baseURL.startsWith('/') ? '' : '/') + baseURL;
	}
	
	return baseURL;
}

/**
 * Current Studio session access token.
 * Matches Directus app getToken(); also handles AxiosHeaders and harvests a token
 * from an already-authenticated media URL on the page (file-preview) as fallback.
 * Remembers the last successful token so replacement-player can clear preview src
 * without losing auth for subsequent /assets/ requests.
 */
let lastKnownAccessToken: string | null = null;

export function getAccessToken(api: any): string | null {
	try {
		// Exact Directus pattern (app/src/api.ts getToken)
		const fromCommon = api?.defaults?.headers?.common?.['Authorization']?.split?.(' ')?.[1];
		if (fromCommon) {
			lastKnownAccessToken = fromCommon;
			return fromCommon;
		}

		const candidates: unknown[] = [
			api?.defaults?.headers?.common?.Authorization,
			api?.defaults?.headers?.Authorization,
			api?.defaults?.headers?.common?.authorization,
			api?.defaults?.headers?.authorization,
		];

		if (typeof api?.defaults?.headers?.common?.get === 'function') {
			candidates.push(api.defaults.headers.common.get('Authorization'));
		}
		if (typeof api?.defaults?.headers?.get === 'function') {
			candidates.push(api.defaults.headers.get('Authorization'));
		}

		for (const auth of candidates) {
			if (auth == null) continue;
			const str = Array.isArray(auth) ? String(auth[0] ?? '') : String(auth);
			const match = str.match(/^Bearer\s+(.+)$/i);
			if (match?.[1]) {
				lastKnownAccessToken = match[1];
				return match[1];
			}
			// Raw JWT already (no Bearer prefix)
			if (/^eyJ[A-Za-z0-9_-]+\./.test(str)) {
				lastKnownAccessToken = str;
				return str;
			}
		}

		// Fallback: reuse token from Directus file-preview / other authenticated media
		if (typeof document !== 'undefined') {
			const nodes = document.querySelectorAll<HTMLImageElement | HTMLVideoElement | HTMLAudioElement>(
				'video[src], audio[src], img[src], video source[src]'
			);
			for (const el of nodes) {
				const src = el.getAttribute('src') || ('src' in el ? el.src : '') || '';
				if (!src.includes('access_token=')) continue;
				try {
					const token = new URL(src, window.location.origin).searchParams.get('access_token');
					if (token) {
						lastKnownAccessToken = token;
						return token;
					}
				} catch {
					/* ignore */
				}
			}
		}

		return lastKnownAccessToken;
	} catch {
		return lastKnownAccessToken;
	}
}

/**
 * Whether a URL points at this Directus instance's /assets/ endpoint.
 */
export function isDirectusAssetUrl(url: string, api?: any): boolean {
	if (!url) return false;
	try {
		if (url.startsWith('/assets/') || url.startsWith('assets/')) return true;
		const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
		if (!parsed.pathname.includes('/assets/')) return false;
		if (typeof window === 'undefined') return true;
		const base = api ? normalizeApiBaseUrl(api) : window.location.origin;
		const baseOrigin = new URL(base, window.location.origin).origin;
		return parsed.origin === baseOrigin || parsed.origin === window.location.origin;
	} catch {
		return false;
	}
}

/**
 * Append access_token query param for Directus /assets/ media (video tags / native HLS).
 * Leaves external / non-asset URLs unchanged. Refreshes token if already present.
 */
export function addAccessTokenToUrl(url: string | null | undefined, api: any): string | null {
	if (!url) return null;
	const token = getAccessToken(api);
	if (!token) return url;
	if (!isDirectusAssetUrl(url, api)) return url;

	try {
		const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
		parsed.searchParams.set('access_token', token);
		if (url.startsWith('/')) {
			return `${parsed.pathname}${parsed.search}${parsed.hash}`;
		}
		return parsed.toString();
	} catch {
		if (url.includes('access_token=')) {
			return url.replace(/([?&]access_token=)[^&]*/i, `$1${encodeURIComponent(token)}`);
		}
		const sep = url.includes('?') ? '&' : '?';
		return `${url}${sep}access_token=${encodeURIComponent(token)}`;
	}
}

/**
 * hls.js xhrSetup: authorize Directus asset segment/playlist fetches (relative segment URLs drop query tokens).
 */
export function hlsXhrSetup(api: any) {
	return (xhr: XMLHttpRequest, url: string) => {
		const token = getAccessToken(api);
		if (!token) return;
		if (isDirectusAssetUrl(url, api) || (typeof url === 'string' && url.includes('/assets/'))) {
			xhr.setRequestHeader('Authorization', `Bearer ${token}`);
		}
	};
}

/**
 * Attach Directus auth to dash.js RequestModifier (headers + access_token on /assets/ URLs).
 */
export function applyDashAccessToken(player: { extend: (name: string, factory: any, force?: boolean) => void }, api: any) {
	if (!api || !player) return;
	player.extend('RequestModifier', () => ({
		modifyRequestHeader: (xhr: XMLHttpRequest) => {
			const token = getAccessToken(api);
			if (token) {
				xhr.setRequestHeader('Authorization', `Bearer ${token}`);
			}
			return xhr;
		},
		modifyRequestURL: (url: string) => {
			if (!isDirectusAssetUrl(url, api) && !url.includes('/assets/')) return url;
			return addAccessTokenToUrl(url, api) || url;
		}
	}), true);
}

/**
 * Get file ID from context (route params or attrs)
 */
export function getFileIdFromContext(attrs?: any): string | null {
	// Try to get from route params
	if (typeof window !== 'undefined') {
		const pathMatch = window.location.pathname.match(/\/files\/([^\/]+)/);
		if (pathMatch && pathMatch[1]) {
			return pathMatch[1];
		}
	}
	// Try to get from attrs
	if (attrs?.['primary-key']) {
		return attrs['primary-key'] as string;
	}
	return null;
}

