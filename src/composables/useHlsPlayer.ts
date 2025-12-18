/**
 * Composable for managing HLS player instances
 */
import { ref, type Ref } from 'vue';
import Hls from 'hls.js';

export interface HlsPlayerInstance {
	hlsInstance: Ref<Hls | null>;
	playEventListener: Ref<(() => void) | null>;
	currentQuality: Ref<string | null>;
	cspError: Ref<string | null>;
	setupHlsPlayer: (videoEl: HTMLVideoElement, streamUrl: string, fallback?: () => void) => void;
	cleanupHls: (videoElement?: HTMLVideoElement | null) => void;
}

/**
 * Format quality height to display string (e.g., 720 -> "720p", 1080 -> "1080p")
 */
function formatQuality(height: number | undefined): string | null {
	if (!height) return null;
	
	// Common resolutions
	if (height >= 2160) return '4K';
	if (height >= 1440) return '1440p';
	if (height >= 1080) return '1080p';
	if (height >= 720) return '720p';
	if (height >= 540) return '540p';
	if (height >= 480) return '480p';
	if (height >= 360) return '360p';
	if (height >= 240) return '240p';
	
	// Fallback to height value
	return `${height}p`;
}

/**
 * Setup HLS player on a video element
 */
/**
 * Check if an error message indicates a CSP violation
 */
function isCspError(errorMessage: string): boolean {
	const cspKeywords = [
		'Content Security Policy',
		'media-src',
		'blob:',
		'violates the following Content Security Policy directive'
	];
	const lowerMessage = errorMessage.toLowerCase();
	return cspKeywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()));
}

// Module-level state for console error interception
let consoleErrorInterceptorActive = false;
let originalConsoleError: typeof console.error | null = null;
const activeErrorCallbacks = new Set<() => void>();

/**
 * Set up a global console.error interceptor to catch CSP violations
 * This is shared across all instances of the composable
 */
function setupConsoleErrorInterceptor() {
	if (typeof window === 'undefined' || consoleErrorInterceptorActive) {
		return;
	}
	
	originalConsoleError = console.error;
	consoleErrorInterceptorActive = true;
	
	console.error = (...args: any[]) => {
		const message = args.map(arg => {
			if (typeof arg === 'string') return arg;
			if (arg && typeof arg === 'object') {
				try {
					return JSON.stringify(arg);
				} catch {
					return String(arg);
				}
			}
			return String(arg);
		}).join(' ');
		
		// Check if this is a CSP error message about media-src and blob URLs
		const hasCspKeywords = isCspError(message) || 
			message.includes('violates the following Content Security Policy') ||
			message.includes('Content Security Policy directive') ||
			message.toLowerCase().includes('content security policy');
		
		// Check for CSP indicators: blob URLs, media-src, or "Media load rejected by URL safety check"
		const hasBlobOrMedia = message.includes('blob:') || 
			message.includes('media-src') || 
			message.toLowerCase().includes('media') ||
			message.includes('Media load rejected by URL safety check') ||
			message.includes('MEDIA_ELEMENT_ERROR');
		
		const isCspViolation = hasCspKeywords && hasBlobOrMedia;
		
		if (isCspViolation) {
			// Notify all active error callbacks
			activeErrorCallbacks.forEach((callback) => {
				try {
					callback();
				} catch (error) {
					console.error('[CSP Interceptor] Error in callback:', error);
				}
			});
		}
		
		// Always call the original console.error
		if (originalConsoleError) {
			originalConsoleError.apply(console, args);
		}
	};
}

export function useHlsPlayer(videoElement: Ref<HTMLVideoElement | null>): HlsPlayerInstance {
	const hlsInstance = ref<Hls | null>(null);
	const playEventListener = ref<(() => void) | null>(null);
	const currentQuality = ref<string | null>(null);
	const cspError = ref<string | null>(null);
	
	// Store CSP violation listener reference
	let cspViolationListener: ((event: SecurityPolicyViolationEvent) => void) | null = null;
	
	// Helper function to set CSP error
	const setCspError = () => {
		// Only set error if not already set to avoid unnecessary updates
		if (cspError.value) {
			return;
		}
		const errorMessage = 'Content Security Policy (CSP) is blocking HLS streaming. Please add the following environment variable to your Directus configuration:\n\nCONTENT_SECURITY_POLICY_DIRECTIVES__MEDIA_SRC=array:\'self\', blob: data:';
		cspError.value = errorMessage;
	};
	
	// Set up global CSP violation listener (only once per composable instance)
	if (typeof window !== 'undefined') {
		// Listen for SecurityPolicyViolationEvent (preferred method)
		cspViolationListener = (event: SecurityPolicyViolationEvent) => {
			// Check if this is a media-src violation (which affects video playback)
			if (event.violatedDirective === 'media-src' || event.violatedDirective === 'default-src') {
				// Check if the blocked URL is a blob URL (which HLS.js uses)
				if (event.blockedURI && (event.blockedURI.startsWith('blob:') || event.blockedURI.includes('blob:'))) {
					setCspError();
				}
			}
		};
		
		window.addEventListener('securitypolicyviolation', cspViolationListener);
		
		// Set up console error interceptor (shared across all instances)
		setupConsoleErrorInterceptor();
		
		// Register this instance's error callback for console error notifications
		activeErrorCallbacks.add(setCspError);
	}

	const setupHlsPlayer = (videoEl: HTMLVideoElement, streamUrl: string, fallback?: () => void) => {
		// Reset CSP error when setting up a new player
		if (videoEl === videoElement.value) {
			cspError.value = null;
		}
		
		// Error handler for video element errors (CSP detection ONLY)
		const handleVideoError = (event: Event) => {
			const error = (event.target as HTMLVideoElement)?.error;
			if (error) {
				// ONLY treat as CSP error if:
				// Error code is 4 (MEDIA_ERR_SRC_NOT_SUPPORTED) AND
				// Error message contains "URL safety check" (this is the SPECIFIC CSP indicator)
				// Do NOT treat error code 2 (network errors like 404/403) as CSP
				if (error.code === 4) {
					const errorMessage = error.message || '';
					// "URL safety check" is the specific message browsers show when CSP blocks blob URLs
					if (errorMessage.includes('URL safety check')) {
						if (hlsInstance.value && videoEl === videoElement.value) {
							setCspError();
						}
					}
				}
				// All other errors (404, 403, network errors, etc.) are NOT CSP errors
			}
		};
		
		// Listen for video element errors
		videoEl.addEventListener('error', handleVideoError);
		
		// Also try to detect CSP errors by checking if video fails to load after a delay
		// This is a fallback for when the error event doesn't fire properly
		// Only check for error code 4 with "URL safety check" message (specific CSP indicator)
		const checkForCspError = setTimeout(() => {
			if (videoEl === videoElement.value && hlsInstance.value) {
				// Check if video is in error state
				if (videoEl.error) {
					const error = videoEl.error;
					const errorMessage = error.message || '';
					
					// Only treat as CSP if error code is 4 with "URL safety check" message
					// Do NOT treat error code 2 (network errors like 404/403) as CSP
					if (error.code === 4 && errorMessage.includes('URL safety check')) {
						setCspError();
					}
				}
			}
		}, 2000); // Check after 2 seconds
		
		// Clear the timeout if video loads successfully
		videoEl.addEventListener('loadedmetadata', () => {
			clearTimeout(checkForCspError);
		}, { once: true });
		
		if (streamUrl && Hls.isSupported()) {
			// Use HLS.js for HLS streaming
			const hls = new Hls({
				enableWorker: true,
				lowLatencyMode: true,
				backBufferLength: 90,
				autoStartLoad: true, // False: Don't start loading until user clicks play
				maxBufferLength: 3, // Maximum buffer length in seconds (limits preloading)
				maxMaxBufferLength: 6, // Maximum max buffer length
				maxBufferSize: 60 * 1000 * 1000 // Maximum buffer size in bytes (60MB)
			});
			
			// Listen for HLS.js errors
			hls.on(Hls.Events.ERROR, (event, data) => {
				if (data.fatal) {
					let errorMessage = '';
					if (data.error) {
						errorMessage = data.error.message || String(data.error);
					} else if (data.details) {
						errorMessage = data.details;
					}
					
					// Only treat as CSP error if error message explicitly mentions CSP blocking blob URLs
					// Do NOT treat 404/403/network errors as CSP unless they explicitly mention CSP
					const errorMessageIndicatesCsp = isCspError(errorMessage) || 
						(errorMessage.includes('blob') && errorMessage.includes('blocked') && errorMessage.includes('Content Security Policy'));
					
					// Only set CSP error if we have clear evidence of CSP violation
					if (errorMessageIndicatesCsp && videoEl === videoElement.value) {
						setCspError();
					}
					// Do NOT set CSP error for regular network errors (404, 403, etc.)
				}
			});
			
			hls.loadSource(streamUrl);
			hls.attachMedia(videoEl);
			
			// Add play event listener to start loading when user clicks play
			const onPlayHandler = () => {
				if (hls) {
					hls.startLoad();
					// Remove the event listener after calling startLoad once
					videoEl.removeEventListener('play', onPlayHandler);
				}
			};
			
			videoEl.addEventListener('play', onPlayHandler);
			
			// Helper function to update quality from current level
			const updateQuality = () => {
				if (hls.levels && hls.levels.length > 0) {
					const currentLevelIndex = hls.currentLevel;
					if (currentLevelIndex >= 0 && currentLevelIndex < hls.levels.length) {
						const level = hls.levels[currentLevelIndex];
						const quality = formatQuality(level.height);
						// Update quality if this is the main player instance
						if (hls === hlsInstance.value || videoEl === videoElement.value) {
							currentQuality.value = quality;
						}
					} else if (hls.levels.length > 0) {
						// If no specific level is selected (auto), try to get the currently playing level
						// or use the highest quality level
						const sortedLevels = [...hls.levels].sort((a, b) => (b.height || 0) - (a.height || 0));
						const level = sortedLevels[0];
						const quality = formatQuality(level.height);
						// Update quality if this is the main player instance
						if (hls === hlsInstance.value || videoEl === videoElement.value) {
							currentQuality.value = quality;
						}
					}
				}
			};
			
			// Video is ready to play - user can click play button to start
			hls.on(Hls.Events.MANIFEST_PARSED, () => {
				// Video loaded and ready - controls will allow user to play
				// Use setTimeout to ensure levels are fully populated
				setTimeout(() => {
					updateQuality();
				}, 100);
			});
			
			// Listen for level switches to update quality
			hls.on(Hls.Events.LEVEL_SWITCHED, () => {
				updateQuality();
			});
			
			// Also listen for when a level is loaded
			hls.on(Hls.Events.LEVEL_LOADED, () => {
				updateQuality();
			});
			
			// Store instance if it's our main player
			if (videoEl === videoElement.value) {
				hlsInstance.value = hls;
				playEventListener.value = onPlayHandler;
				// Update quality immediately if levels are already available
				if (hls.levels && hls.levels.length > 0) {
					updateQuality();
				}
			}
		} else if (streamUrl && videoEl.canPlayType('application/vnd.apple.mpegurl')) {
			// Native HLS support (Safari)
			// Also set up error handler for native HLS
			videoEl.addEventListener('error', handleVideoError);
			videoEl.src = streamUrl;
		} else {
			console.warn('HLS not supported in this browser');
			if (fallback) {
				fallback();
			}
		}
	};

	const cleanupHls = (videoEl?: HTMLVideoElement | null) => {
		const el = videoEl || videoElement.value;
		
		// Remove play event listener if it exists
		if (el && playEventListener.value) {
			el.removeEventListener('play', playEventListener.value);
			playEventListener.value = null;
		}
		
		if (hlsInstance.value) {
			hlsInstance.value.destroy();
			hlsInstance.value = null;
		}
		
		// Reset quality and error when cleaning up
		currentQuality.value = null;
		if (el === videoElement.value) {
			cspError.value = null;
		}
		
		// Clean up global listeners when the video element is cleaned up
		if (el === videoElement.value && typeof window !== 'undefined') {
			if (cspViolationListener) {
				window.removeEventListener('securitypolicyviolation', cspViolationListener);
				cspViolationListener = null;
			}
			// Unregister this instance's error callback
			activeErrorCallbacks.delete(setCspError);
			// Note: We don't restore console.error here as other instances might need it
			// The console interceptor is shared and will remain active
		}
	};

	return {
		hlsInstance: hlsInstance as Ref<Hls | null>,
		playEventListener,
		currentQuality: currentQuality as Ref<string | null>,
		cspError: cspError as Ref<string | null>,
		setupHlsPlayer,
		cleanupHls
	};
}

