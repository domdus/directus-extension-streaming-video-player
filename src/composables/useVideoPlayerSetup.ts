/**
 * Composable for video player setup and management
 */
import { ref, type Ref, computed } from 'vue';
import type { useHlsPlayer } from './useHlsPlayer';

export function useVideoPlayerSetup(
	videoElement: Ref<HTMLVideoElement | null>,
	setupHlsPlayer: ReturnType<typeof useHlsPlayer>['setupHlsPlayer'],
	cleanupHls: ReturnType<typeof useHlsPlayer>['cleanupHls'],
	isStringField: Ref<boolean>,
	shouldReplaceDefaultPlayer: Ref<boolean>,
	streamUrlFromValue: Ref<string | null>,
	useHls: Ref<boolean>,
	mp4Url: Ref<string | null>,
	fileData: Ref<any>,
	streamLinkFieldName: Ref<string>,
	getStreamUrl: (streamLink: string) => string | null,
	videoUrl: Ref<string | null>
) {
	const videoPreload = computed(() => {
		return useHls.value ? 'none' : 'metadata';
	});

	const setupVideoPlayer = () => {
		if (!videoElement.value) {
			console.warn('[VideoPlayerSetup] Video element not available');
			return;
		}
		
		// For string fields, we don't need fileData
		if (isStringField.value && !shouldReplaceDefaultPlayer.value) {
			// String field but not replacing default player - setup our own player
			cleanupHls();
			
			if (!videoElement.value) {
				console.warn('[VideoPlayerSetup] Video element not available for string field setup');
				return;
			}
			
		if (useHls.value) {
			// Use HLS
			const streamUrl = streamUrlFromValue.value;
			if (streamUrl) {
					setupHlsPlayer(videoElement.value, streamUrl, () => {
						// Fallback to MP4 if needed (though this shouldn't happen for string fields)
						if (mp4Url.value) {
							videoElement.value!.preload = 'metadata';
							videoElement.value!.src = mp4Url.value;
							videoElement.value!.load();
						} else {
							console.warn('[VideoPlayerSetup] No stream URL and no MP4 URL available for string field');
						}
					});
				} else {
					console.warn('[VideoPlayerSetup] No stream URL available for string field HLS playback. Value:', streamUrlFromValue.value);
				}
			} else {
				// Use MP4 (for string fields, this is unlikely but handle it)
				if (mp4Url.value) {
					// Set preload to metadata to load first frame - use both methods to ensure it works
					videoElement.value.setAttribute('preload', 'metadata');
					videoElement.value.preload = 'metadata';
					videoElement.value.src = mp4Url.value;
					videoElement.value.load();
				} else {
					console.warn('[VideoPlayerSetup] No MP4 URL available for string field MP4 playback');
				}
			}
			return;
		}
		
		// For file fields, we need fileData
		if (!fileData.value) {
			console.warn('[VideoPlayerSetup] File field setup called but fileData is not available');
			return;
		}
		
		cleanupHls();
		
		// If stream link field is configured and available, use HLS.js
		if (streamLinkFieldName.value) {
			const streamLinkValue = fileData.value?.[streamLinkFieldName.value];
			if (streamLinkValue) {
				const streamUrl = getStreamUrl(streamLinkValue);
				if (streamUrl) {
					setupHlsPlayer(videoElement.value, streamUrl, () => {
						// Fallback to MP4 if HLS fails
						if (videoUrl.value) {
							videoElement.value!.src = videoUrl.value;
						}
					});
					return;
				}
			}
		}
		
		// No stream link field configured or available - use traditional MP4 playback
		if (videoUrl.value && videoElement.value) {
			// Set preload to metadata to load first frame for MP4
			videoElement.value.setAttribute('preload', 'metadata');
			videoElement.value.preload = 'metadata';
			videoElement.value.src = videoUrl.value;
			videoElement.value.load();
		} else {
			console.warn('[VideoPlayerSetup] No video URL available for file field playback', {
				videoUrl: videoUrl.value,
				hasVideoElement: !!videoElement.value
			});
		}
	};

	const openFullscreen = () => {
		if (!videoElement.value) return;
		if (videoElement.value.requestFullscreen) {
			videoElement.value.requestFullscreen();
		}
	};

	const onVideoLoaded = () => {
		// Video metadata loaded
	};

	return {
		videoPreload,
		setupVideoPlayer,
		openFullscreen,
		onVideoLoaded
	};
}

