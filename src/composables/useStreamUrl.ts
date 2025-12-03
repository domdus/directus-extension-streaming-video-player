/**
 * Composable for generating stream URLs with optional secure token authentication
 */
import { computed, type ComputedRef } from 'vue';
import CryptoJS from 'crypto-js';
import { normalizeApiBaseUrl } from '../utils';

interface StreamUrlOptions {
	hostUrl?: string;
	streamSecret?: string;
	includeIp?: boolean;
	api: any;
}

/**
 * Generate secure path hash for token-based authentication
 */
function generateSecurePathHash(
	expires: string,
	ip: string | null,
	secret: string,
	includeIp: boolean = false
): string {
	if (!expires) {
		throw new Error('Must provide expires');
	}
	if (!secret) {
		// Return empty string if no secret (stream secret is optional)
		return '';
	}

	// Generate MD5 hash using crypto-js (browser-compatible)
	// Include IP only if includeIp is true and ip is provided
	const input = includeIp && ip ? expires + ' ' + ip + ' ' + secret : expires + ' ' + secret;
	const binaryHash = CryptoJS.MD5(input);
	const base64Value = CryptoJS.enc.Base64.stringify(binaryHash);
	
	// Apply URL-safe base64 encoding (same as Node.js Buffer.toString('base64'))
	return base64Value.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Get stream URL from stream link
 */
export function useStreamUrl(options: StreamUrlOptions) {
	const apiBaseUrl = computed(() => normalizeApiBaseUrl(options.api));

	const getStreamUrl = (streamLink: string): string | null => {
		if (!streamLink) return null;

		// If streamLink is already a fully qualified URL (http:// or https://), return it directly
		// This allows external HLS streams (e.g., Cloudflare Stream) to work without hostUrl/secret configuration
		if (streamLink.startsWith('http://') || streamLink.startsWith('https://')) {
			return streamLink;
		}
		
		try {
			// Get hostUrl template
			let hostUrlTemplate = options.hostUrl || '';
			
			// If hostUrl is not set, construct it from apiBaseUrl or window.location
			if (!hostUrlTemplate) {
				const baseUrl = apiBaseUrl.value || window.location.origin + '/api';
				hostUrlTemplate = baseUrl.replace('/api', '') || window.location.origin;
			}
			
			// Ensure hostUrl has a protocol
			if (!hostUrlTemplate.startsWith('http://') && !hostUrlTemplate.startsWith('https://')) {
				hostUrlTemplate = window.location.origin;
			}
			
			// Decode URL-encoded characters (in case Directus encoded the template placeholders)
			// This handles cases where {{token}} becomes %7B%7Btoken%7D%7D
			try {
				hostUrlTemplate = decodeURIComponent(hostUrlTemplate);
			} catch (e) {
				// If decoding fails, use original value
			}
			
			// Get stream secret
			let streamSecret = options.streamSecret || '';
			
			// Normalize hostUrlTemplate - remove trailing slash
			hostUrlTemplate = hostUrlTemplate.replace(/\/+$/, '');
			
			// Normalize streamLink - ensure it starts with /
			if (!streamLink.startsWith('/')) {
				streamLink = '/' + streamLink;
			}
			
			// Check if template placeholders exist FIRST - only add token/expires if placeholders are present
			// Support {{token}} and {{expires}} placeholders in hostUrl
			const hasTokenPlaceholder = hostUrlTemplate.includes('{{token}}');
			const hasExpiresPlaceholder = hostUrlTemplate.includes('{{expires}}');
			const hasTemplateSyntax = hasTokenPlaceholder || hasExpiresPlaceholder;
			
			if (hasTemplateSyntax) {
				// Template syntax detected - we need to replace placeholders
				if (!streamSecret) {
					// If no secret, remove placeholders and return URL without token/expires
					const normalizedHost = hostUrlTemplate.replace(/\{\{token\}\}/g, '').replace(/\{\{expires\}\}/g, '');
					// Normalize - remove trailing slash
					const cleanHost = normalizedHost.replace(/\/+$/, '');
					return cleanHost + streamLink;
				}
				
				// We have secret and template syntax - generate token/expires and replace placeholders
				// Get includeIp option (default to false)
				const includeIp = options.includeIp ?? false;
				
				// Get IP address if needed (in browser, we can't get real IP, so use empty string)
				// The server-side validation should handle the actual IP check
				const ip = includeIp ? '' : null;
				
				// Generate expiration timestamp (1 hour from now)
				const expiresTimestamp = new Date(Date.now() + (1000 * 60 * 60)).getTime();
				const expires = String(Math.round(expiresTimestamp / 1000));
				
				// Generate secure token
				const token = generateSecurePathHash(expires, ip, streamSecret, includeIp);
				
				// Replace {{token}} and {{expires}} placeholders
				let streamUrl = hostUrlTemplate
					.replace(/\{\{token\}\}/g, token)
					.replace(/\{\{expires\}\}/g, expires);
				
				// Normalize - remove trailing slash from hostUrl
				streamUrl = streamUrl.replace(/\/+$/, '');
				
				// Append streamLink (it already starts with /)
				return streamUrl + streamLink;
			} else {
				// No template syntax - don't add token/expires, just return hostUrl + streamLink
				return hostUrlTemplate + streamLink;
			}
		} catch (error) {
			console.error('Failed to construct stream URL:', error);
			return `${window.location.origin}${streamLink}`;
		}
	};

	return {
		getStreamUrl,
		apiBaseUrl
	};
}

