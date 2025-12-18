/**
 * Composable for managing DASH player instances
 */
import { ref, type Ref, watch } from 'vue';
import * as dashjs from 'dashjs';

export interface DashPlayerInstance {
	dashInstance: Ref<dashjs.MediaPlayerClass | null>;
	currentQuality: Ref<string | null>;
	cspError: Ref<string | null>;
	setupDashPlayer: (videoEl: HTMLVideoElement, streamUrl: string, fallback?: () => void) => void;
	cleanupDash: (videoElement?: HTMLVideoElement | null) => void;
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
 * Check if a URL is a DASH stream (typically ends with .mpd)
 */
export function isDashStream(url: string): boolean {
	if (!url) return false;
	const lowerUrl = url.toLowerCase();
	return lowerUrl.endsWith('.mpd') || lowerUrl.includes('/dash/') || lowerUrl.includes('format=dash');
}

/**
 * Setup DASH player on a video element
 */
// Import the shared console error interceptor setup (we'll need to export it from useHlsPlayer or create a shared module)
// For now, we'll use a similar pattern but register with the shared callback system
// We need to import the setup function and callback registry from useHlsPlayer
// Actually, let's create a shared approach - DASH will also detect CSP errors via video element errors

export function useDashPlayer(videoElement: Ref<HTMLVideoElement | null>): DashPlayerInstance {
	const dashInstance = ref<dashjs.MediaPlayerClass | null>(null);
	const currentQuality = ref<string | null>(null);
	const cspError = ref<string | null>(null);
	// Track event listener cleanup functions per video element
	const eventCleanups = new Map<HTMLVideoElement, () => void>();
	
	// Helper function to set CSP error
	const setCspError = () => {
		// Only set error if not already set to avoid unnecessary updates
		if (cspError.value) {
			return;
		}
		const errorMessage = 'Content Security Policy (CSP) is blocking DASH streaming. Please add the following environment variable to your Directus configuration:\n\nCONTENT_SECURITY_POLICY_DIRECTIVES__MEDIA_SRC=array:\'self\', blob: data:';
		cspError.value = errorMessage;
	};
	

		const setupDashPlayer = (videoEl: HTMLVideoElement, streamUrl: string, fallback?: () => void) => {
			if (!streamUrl) {
				if (fallback) fallback();
				return;
			}

			// Reset CSP error when setting up a new player
			if (videoEl === videoElement.value) {
				cspError.value = null;
			}

			// Clean up any existing player for this video element first
			if (videoEl === videoElement.value && dashInstance.value) {
				try {
					dashInstance.value.reset();
					dashInstance.value.destroy();
				} catch (e) {
					console.warn('[DashPlayer] Error cleaning up existing player:', e);
				}
				dashInstance.value = null;
				currentQuality.value = null;
			}

			try {
				// Create DASH player instance
				const player = dashjs.MediaPlayer().create();
			
			// Configure player settings (removed deprecated maxBufferLength settings)
			player.updateSettings({
				streaming: {
					buffer: {
						bufferTimeAtTopQuality: 30,
						bufferTimeAtTopQualityLongForm: 30,
						longFormContentDurationThreshold: 600,
						initialBufferLevel: 30,
						fastSwitchEnabled: true
					},
					abr: {
						useDefaultABRRules: true,
						initialBitrate: {
							audio: -1,
							video: -1
						}
					}
				}
			});

			// Store instance if it's our main player FIRST (before setting up events)
			const isMainPlayer = videoEl === videoElement.value;
			if (isMainPlayer) {
				dashInstance.value = player;
			}

			// Helper function to update quality - using official dash.js reference player approach
			// Based on: https://github.com/Dash-Industry-Forum/dash.js/blob/development/samples/dash-if-reference-player/app/main.js
			// IMPORTANT: Always use dashInstance.value (the stored instance), not the closure variable
			const updateQuality = (representation?: any) => {
				try {
					// Only update quality for the main player instance
					// Check if this is the main video element
					if (videoEl !== videoElement.value) {
						return;
					}
					
					// Always use the stored instance - this is the source of truth
					// Don't compare to closure variable 'player' as it might be from a previous setup
					const currentPlayer = dashInstance.value;
					if (!currentPlayer) {
						return;
					}
					
					// Use the stored player instance (not the closure variable)
					const playerAny = currentPlayer as any;
					let currentRep = representation;
					
					// If representation provided from event, use it
					if (currentRep && currentRep.height) {
						const quality = formatQuality(currentRep.height);
						if (quality) {
							currentQuality.value = quality;
							return;
						}
					}
					
					// Try new API methods first
					if (!currentRep) {
						currentRep = playerAny.getCurrentRepresentationForType?.('video');
					}
					
					// Try old API methods as fallback (for older dash.js versions)
					if (!currentRep) {
						const qualityIndex = playerAny.getQualityFor?.('video');
						if (qualityIndex !== undefined && qualityIndex !== null) {
							const bitrateList = playerAny.getBitrateInfoListFor?.('video') || [];
							if (bitrateList[qualityIndex]) {
								currentRep = bitrateList[qualityIndex];
							}
						}
					}
					
					// Try getting from representations list
					if (!currentRep) {
						const representations = playerAny.getRepresentationsByType?.('video') || [];
						if (representations.length > 0) {
							// Try to find current representation by quality index
							const qualityIndex = playerAny.getQualityFor?.('video');
							if (qualityIndex !== undefined && qualityIndex !== null && representations[qualityIndex]) {
								currentRep = representations[qualityIndex];
							} else {
								currentRep = representations[0];
							}
						}
					}
					
					// Fallback: use video element dimensions
					if (!currentRep || !currentRep.height) {
						const videoHeight = videoEl.videoHeight;
						if (videoHeight && videoHeight > 0) {
							const quality = formatQuality(videoHeight);
							if (quality) {
								currentQuality.value = quality;
								return;
							}
						}
					}
					
					// If we have a representation with height, use it
					if (currentRep && currentRep.height) {
						const quality = formatQuality(currentRep.height);
						if (quality) {
							currentQuality.value = quality;
						}
					}
				} catch (error) {
					console.error('[DashPlayer] Error updating quality:', error);
				}
			};

			// Set up event listeners - using official dash.js reference player approach
			const Events = dashjs.MediaPlayer.events;
			if (Events && isMainPlayer) {
				// Listen for stream initialized - representations are available after this
				if (Events.STREAM_INITIALIZED) {
					player.on(Events.STREAM_INITIALIZED, () => {
						// Only update if this is the main video element
						// Don't check player instance - use whatever is stored
						if (videoEl === videoElement.value && dashInstance.value) {
							updateQuality();
						}
					});
				}

				// Listen for quality changes - event provides newRepresentation directly
				if (Events.QUALITY_CHANGE_RENDERED) {
					player.on(Events.QUALITY_CHANGE_RENDERED, (e: any) => {
						// Only update if this is the main video element
						// Don't check player instance - use whatever is stored
						if (videoEl === videoElement.value && dashInstance.value) {
							// Use the representation from the event like the reference player does
							if (e && e.newRepresentation && e.mediaType === 'video') {
								updateQuality(e.newRepresentation);
							} else {
								updateQuality();
							}
						}
					});
				}
			}

		// Error handler for video element errors (CSP detection)
		const handleVideoError = (event: Event) => {
			const error = (event.target as HTMLVideoElement)?.error;
			if (error) {
				// Only treat as CSP error if:
				// 1. Error code is 4 (MEDIA_ERR_SRC_NOT_SUPPORTED) AND
				// 2. Error message contains "URL safety check" (this is the specific message for CSP blocking blob URLs)
				// Do NOT treat error code 2 (network errors like 404/403) as CSP
				if (error.code === 4) {
					const errorMessage = error.message || '';
					// Error code 4 with "URL safety check" message is specifically CSP blocking blob URLs
					if (errorMessage.includes('URL safety check')) {
						if (dashInstance.value && videoEl === videoElement.value) {
							setCspError();
						}
					}
				}
				// Do NOT set CSP error for error code 2 (network errors) - these are 404/403/etc, not CSP
			}
		};
			
			// Listen for video element errors
			videoEl.addEventListener('error', handleVideoError);
			
			// Also listen to video element metadata events as fallback
			if (isMainPlayer) {
				const onLoadedMetadata = () => {
					// Try to update quality when video metadata is loaded
					if (dashInstance.value === player && videoEl === videoElement.value) {
						updateQuality();
					}
				};
				videoEl.addEventListener('loadedmetadata', onLoadedMetadata);
				
				// Store cleanup function for this video element
				const existingCleanup = eventCleanups.get(videoEl);
				eventCleanups.set(videoEl, () => {
					videoEl.removeEventListener('error', handleVideoError);
					videoEl.removeEventListener('loadedmetadata', onLoadedMetadata);
					if (existingCleanup) {
						existingCleanup();
					}
				});
			} else {
				// Store cleanup for error handler even if not main player
				const existingCleanup = eventCleanups.get(videoEl);
				eventCleanups.set(videoEl, () => {
					videoEl.removeEventListener('error', handleVideoError);
					if (existingCleanup) {
						existingCleanup();
					}
				});
			}
			
		// Also try to detect CSP errors by checking if video fails to load after a delay
		// This is a fallback for when the error event doesn't fire properly
		// Only check for error code 4 with "URL safety check" message (specific CSP indicator)
		const checkForCspError = setTimeout(() => {
			if (videoEl === videoElement.value && dashInstance.value) {
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
			
			// Initialize player with video element and stream URL
			player.initialize(videoEl, streamUrl, false);

		} catch (error) {
			console.error('[DashPlayer] Error setting up DASH player:', error);
			if (fallback) {
				fallback();
			}
		}
	};

	const cleanupDash = (videoEl?: HTMLVideoElement | null) => {
		// Clean up event listeners if video element is provided
		if (videoEl) {
			const cleanup = eventCleanups.get(videoEl);
			if (cleanup) {
				cleanup();
				eventCleanups.delete(videoEl);
			}
		}
		
		if (dashInstance.value) {
			try {
				dashInstance.value.reset();
				dashInstance.value.destroy();
			} catch (error) {
				console.warn('[DashPlayer] Error cleaning up DASH player:', error);
			}
			dashInstance.value = null;
		}
		
		// Reset quality and error when cleaning up
		currentQuality.value = null;
		if (videoEl === videoElement.value) {
			cspError.value = null;
		}
	};

	return {
		dashInstance: dashInstance as Ref<dashjs.MediaPlayerClass | null>,
		currentQuality: currentQuality as Ref<string | null>,
		cspError: cspError as Ref<string | null>,
		setupDashPlayer,
		cleanupDash
	};
}
