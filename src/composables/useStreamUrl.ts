/**
 * Composable for generating stream URLs with optional secure token authentication
 */
import { computed } from 'vue';
import CryptoJS from 'crypto-js';
import { normalizeApiBaseUrl } from '../utils';

interface StreamUrlOptions {
	hostUrl?: string;
	urlSchema?: string;
	streamSecret?: string;
	includeIp?: boolean;
	expiresInMinutes?: number;
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
			// Get stream secret
			const streamSecret = options.streamSecret || '';
			
			// Normalize streamLink - remove leading slash if present (we'll handle it in the schema)
			// But keep it if it's part of the path structure
			let normalizedStreamLink = streamLink;
			if (normalizedStreamLink.startsWith('/')) {
				normalizedStreamLink = normalizedStreamLink.substring(1);
			}
			
			// If url_schema is provided, use it
			if (options.urlSchema) {
				let urlSchema = options.urlSchema;
				
				// Decode URL-encoded characters (in case Directus encoded the template placeholders)
				try {
					urlSchema = decodeURIComponent(urlSchema);
				} catch (e) {
					// If decoding fails, use original value
				}
				
				// Get host URL
				let hostUrl = options.hostUrl || '';
				
				// If hostUrl is not set, construct it from apiBaseUrl or window.location
				if (!hostUrl) {
					const baseUrl = apiBaseUrl.value || window.location.origin + '/api';
					hostUrl = baseUrl.replace('/api', '') || window.location.origin;
				}
				
				// Ensure hostUrl has a protocol
				if (!hostUrl.startsWith('http://') && !hostUrl.startsWith('https://')) {
					hostUrl = window.location.origin;
				}
				
				// Normalize hostUrl - remove trailing slash
				hostUrl = hostUrl.replace(/\/+$/, '');
				
				// Replace {{host_url}} placeholder
				urlSchema = urlSchema.replace(/\{\{host_url\}\}/g, hostUrl);
				
				// Check for other placeholders
				const hasTokenPlaceholder = urlSchema.includes('{{token}}');
				const hasExpiresPlaceholder = urlSchema.includes('{{expires}}');
				const hasItemPlaceholder = urlSchema.includes('{{item_field}}');
				
				// Replace {{item_field}} placeholder with the streamLink value (doesn't require secret)
				if (hasItemPlaceholder) {
					urlSchema = urlSchema.replace(/\{\{item_field\}\}/g, normalizedStreamLink);
				}
				
				// Handle token and expires placeholders
				if (hasTokenPlaceholder || hasExpiresPlaceholder) {
					if (!streamSecret) {
						// If no secret, remove token/expires placeholders
						urlSchema = urlSchema.replace(/\{\{token\}\}/g, '').replace(/\{\{expires\}\}/g, '');
					} else {
						// Generate token and expires
						const includeIp = options.includeIp ?? false;
						const ip = includeIp ? '' : null;
						
						// Generate expiration timestamp (default: 60 minutes)
						const expiresInMinutes = options.expiresInMinutes ?? 60;
						const expiresTimestamp = new Date(Date.now() + (expiresInMinutes * 60 * 1000)).getTime();
						const expires = String(Math.round(expiresTimestamp / 1000));
						
						// Generate secure token
						const token = generateSecurePathHash(expires, ip, streamSecret, includeIp);
						
						// Replace {{token}} and {{expires}} placeholders
						urlSchema = urlSchema
							.replace(/\{\{token\}\}/g, token)
							.replace(/\{\{expires\}\}/g, expires);
					}
				}
				
				// If {{item_field}} was not in the schema, append streamLink at the end
				if (!hasItemPlaceholder) {
					// Ensure proper path separator
					const separator = urlSchema.endsWith('/') ? '' : '/';
					return urlSchema + separator + normalizedStreamLink;
				}
				
				// {{item_field}} was replaced, return the schema as-is
				return urlSchema;
			}
			
			// Fallback to old behavior (backward compatibility)
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
			try {
				hostUrlTemplate = decodeURIComponent(hostUrlTemplate);
			} catch (e) {
				// If decoding fails, use original value
			}
			
			// Normalize hostUrlTemplate - remove trailing slash
			hostUrlTemplate = hostUrlTemplate.replace(/\/+$/, '');
			
			// Normalize streamLink - ensure it starts with /
			if (!streamLink.startsWith('/')) {
				streamLink = '/' + streamLink;
			}
			
			// Check if template placeholders exist FIRST - only add token/expires if placeholders are present
			// Support {{token}}, {{expires}}, and {{item_field}} placeholders in hostUrl
			const hasTokenPlaceholder = hostUrlTemplate.includes('{{token}}');
			const hasExpiresPlaceholder = hostUrlTemplate.includes('{{expires}}');
			const hasItemPlaceholder = hostUrlTemplate.includes('{{item_field}}');
			const hasTemplateSyntax = hasTokenPlaceholder || hasExpiresPlaceholder || hasItemPlaceholder;
			
			// Replace {{item_field}} placeholder with streamLink value (doesn't require secret)
			if (hasItemPlaceholder) {
				// Remove leading slash from streamLink for replacement
				const streamLinkValue = streamLink.startsWith('/') ? streamLink.substring(1) : streamLink;
				hostUrlTemplate = hostUrlTemplate.replace(/\{\{item_field\}\}/g, streamLinkValue);
			}
			
			if (hasTemplateSyntax) {
				// Template syntax detected - we need to replace placeholders
				if (!streamSecret && (hasTokenPlaceholder || hasExpiresPlaceholder)) {
					// If no secret but has token/expires placeholders, remove them and return URL
					const normalizedHost = hostUrlTemplate.replace(/\{\{token\}\}/g, '').replace(/\{\{expires\}\}/g, '');
					// Normalize - remove trailing slash
					const cleanHost = normalizedHost.replace(/\/+$/, '');
					// If {{item_field}} was not in template, append streamLink
					if (!hasItemPlaceholder) {
						return cleanHost + streamLink;
					}
					return cleanHost;
				}
				
				// If we have token/expires placeholders, generate and replace them
				if (hasTokenPlaceholder || hasExpiresPlaceholder) {
					// We have secret and template syntax - generate token/expires and replace placeholders
					// Get includeIp option (default to false)
					const includeIp = options.includeIp ?? false;
					
					// Get IP address if needed (in browser, we can't get real IP, so use empty string)
					// The server-side validation should handle the actual IP check
					const ip = includeIp ? '' : null;
					
					// Generate expiration timestamp (default: 60 minutes)
					const expiresInMinutes = options.expiresInMinutes ?? 60;
					const expiresTimestamp = new Date(Date.now() + (expiresInMinutes * 60 * 1000)).getTime();
					const expires = String(Math.round(expiresTimestamp / 1000));
					
					// Generate secure token
					const token = generateSecurePathHash(expires, ip, streamSecret, includeIp);
					
					// Replace {{token}} and {{expires}} placeholders
					hostUrlTemplate = hostUrlTemplate
						.replace(/\{\{token\}\}/g, token)
						.replace(/\{\{expires\}\}/g, expires);
				}
				
				// Normalize - remove trailing slash from hostUrl
				const streamUrl = hostUrlTemplate.replace(/\/+$/, '');
				
				// If {{item_field}} was not in template, append streamLink
				if (!hasItemPlaceholder) {
					return streamUrl + streamLink;
				}
				
				// {{item_field}} was replaced, return as-is
				return streamUrl;
			} else {
				// No template syntax - just append streamLink
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

