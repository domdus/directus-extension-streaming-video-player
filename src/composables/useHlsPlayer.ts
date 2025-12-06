/**
 * Composable for managing HLS player instances
 */
import { ref, type Ref } from 'vue';
import Hls from 'hls.js';

export interface HlsPlayerInstance {
	hlsInstance: Ref<Hls | null>;
	playEventListener: Ref<(() => void) | null>;
	currentQuality: Ref<string | null>;
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
export function useHlsPlayer(videoElement: Ref<HTMLVideoElement | null>): HlsPlayerInstance {
	const hlsInstance = ref<Hls | null>(null);
	const playEventListener = ref<(() => void) | null>(null);
	const currentQuality = ref<string | null>(null);

	const setupHlsPlayer = (videoEl: HTMLVideoElement, streamUrl: string, fallback?: () => void) => {
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
		
		// Reset quality when cleaning up
		currentQuality.value = null;
	};

	return {
		hlsInstance: hlsInstance as Ref<Hls | null>,
		playEventListener,
		currentQuality: currentQuality as Ref<string | null>,
		setupHlsPlayer,
		cleanupHls
	};
}

