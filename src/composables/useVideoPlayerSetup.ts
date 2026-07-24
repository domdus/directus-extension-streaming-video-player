/**
 * Composable for video player setup and management
 */
import { type Ref, computed } from 'vue';
import { addAccessTokenToUrl } from '../utils';
import type { useHlsPlayer } from './useHlsPlayer';
import type { useDashPlayer } from './useDashPlayer';
import { isDashStream } from './useDashPlayer';

export function useVideoPlayerSetup(
	videoElement: Ref<HTMLVideoElement | null>,
	setupHlsPlayer: ReturnType<typeof useHlsPlayer>['setupHlsPlayer'],
	cleanupHls: ReturnType<typeof useHlsPlayer>['cleanupHls'],
	setupDashPlayer: ReturnType<typeof useDashPlayer>['setupDashPlayer'],
	cleanupDash: ReturnType<typeof useDashPlayer>['cleanupDash'],
	isStringField: Ref<boolean>,
	shouldReplaceDefaultPlayer: Ref<boolean>,
	streamUrlFromValue: Ref<string | null>,
	useHls: Ref<boolean>,
	mp4Url: Ref<string | null>,
	fileData: Ref<any>,
	streamLinkFieldName: Ref<string>,
	getStreamUrl: (streamLink: string) => string | null,
	videoUrl: Ref<string | null>,
	api?: any
) {
	const authed = (url: string | null | undefined) => addAccessTokenToUrl(url, api) || url || null;

	const videoPreload = computed(() => {
		// For streaming formats (HLS/DASH), use 'none' to prevent preloading
		// For regular MP4, use 'metadata' to load first frame
		return (useHls.value || streamUrlFromValue.value) ? 'none' : 'metadata';
	});

	const setupVideoPlayer = () => {
		if (!videoElement.value) {
			console.warn('[VideoPlayerSetup] Video element not available');
			return;
		}
		
		// For string fields, we don't need fileData
		if (isStringField.value && !shouldReplaceDefaultPlayer.value) {
			cleanupHls();
			cleanupDash();
			
			if (!videoElement.value) {
				console.warn('[VideoPlayerSetup] Video element not available for string field setup');
				return;
			}
			
			const streamUrl = authed(streamUrlFromValue.value);
			
			if (streamUrl && isDashStream(streamUrl)) {
				setupDashPlayer(videoElement.value, streamUrl, () => {
					const mp4 = authed(mp4Url.value);
					if (mp4) {
						videoElement.value!.preload = 'metadata';
						videoElement.value!.src = mp4;
						videoElement.value!.load();
					} else {
						console.warn('[VideoPlayerSetup] No MP4 URL available for DASH fallback');
					}
				});
				return;
			}
			
			if (useHls.value || (streamUrl && (streamUrl.endsWith('.m3u8') || streamUrl.includes('m3u8')))) {
				if (streamUrl) {
					setupHlsPlayer(videoElement.value, streamUrl, () => {
						const mp4 = authed(mp4Url.value);
						if (mp4) {
							videoElement.value!.preload = 'metadata';
							videoElement.value!.src = mp4;
							videoElement.value!.load();
						} else {
							console.warn('[VideoPlayerSetup] No stream URL and no MP4 URL available for string field');
						}
					});
				} else {
					console.warn('[VideoPlayerSetup] No stream URL available for string field HLS playback. Value:', streamUrlFromValue.value);
				}
				return;
			}
			
			const mp4 = authed(mp4Url.value);
			if (mp4) {
				videoElement.value.setAttribute('preload', 'metadata');
				videoElement.value.preload = 'metadata';
				videoElement.value.src = mp4;
				videoElement.value.load();
			} else {
				console.warn('[VideoPlayerSetup] No MP4 URL available for string field MP4 playback');
			}
			return;
		}
		
		if (!fileData.value) {
			console.warn('[VideoPlayerSetup] File field setup called but fileData is not available');
			return;
		}
		
		cleanupHls();
		cleanupDash();
		
		if (streamLinkFieldName.value) {
			const streamLinkValue = fileData.value?.[streamLinkFieldName.value];
			if (streamLinkValue) {
				const streamUrl = authed(getStreamUrl(streamLinkValue));
				if (streamUrl) {
					if (isDashStream(streamUrl)) {
						setupDashPlayer(videoElement.value, streamUrl, () => {
							const url = authed(videoUrl.value);
							if (url) {
								videoElement.value!.src = url;
							}
						});
						return;
					}
					
					setupHlsPlayer(videoElement.value, streamUrl, () => {
						const url = authed(videoUrl.value);
						if (url) {
							videoElement.value!.src = url;
						}
					});
					return;
				}
			}
		}
		
		const url = authed(videoUrl.value);
		if (url && videoElement.value) {
			videoElement.value.setAttribute('preload', 'metadata');
			videoElement.value.preload = 'metadata';
			videoElement.value.src = url;
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
