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

