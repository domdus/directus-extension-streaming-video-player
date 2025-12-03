/**
 * Composable for managing HLS player instances
 */
import { ref, type Ref } from 'vue';
import Hls from 'hls.js';

export interface HlsPlayerInstance {
	hlsInstance: Ref<Hls | null>;
	playEventListener: Ref<(() => void) | null>;
	setupHlsPlayer: (videoEl: HTMLVideoElement, streamUrl: string, fallback?: () => void) => void;
	cleanupHls: (videoElement?: HTMLVideoElement | null) => void;
}

/**
 * Setup HLS player on a video element
 */
export function useHlsPlayer(videoElement: Ref<HTMLVideoElement | null>): HlsPlayerInstance {
	const hlsInstance = ref<Hls | null>(null);
	const playEventListener = ref<(() => void) | null>(null);

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
			
			// Video is ready to play - user can click play button to start
			hls.on(Hls.Events.MANIFEST_PARSED, () => {
				// Video loaded and ready - controls will allow user to play
			});
			
			// Store instance if it's our main player
			if (videoEl === videoElement.value) {
				hlsInstance.value = hls;
				playEventListener.value = onPlayHandler;
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
	};

	return {
		hlsInstance: hlsInstance as Ref<Hls | null>,
		playEventListener,
		setupHlsPlayer,
		cleanupHls
	};
}

