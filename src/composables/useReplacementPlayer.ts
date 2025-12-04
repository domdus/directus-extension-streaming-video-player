/**
 * Composable for replacement player DOM manipulation logic
 */
import { ref, type Ref } from 'vue';
import Hls from 'hls.js';
import { getFileIdFromContext } from '../utils';
import type { useApi } from '@directus/extensions-sdk';

export function useReplacementPlayer(
	props: any,
	attrs: any,
	api: ReturnType<typeof useApi>,
	shouldReplaceDefaultPlayer: Ref<boolean>,
	streamUrlFromValue: Ref<string | null>,
	useHls: Ref<boolean>,
	setupHlsPlayer: (videoEl: HTMLVideoElement, streamUrl: string, fallback?: () => void) => void,
	mp4Url: Ref<string | null>
) {
	const replacementVideoElement = ref<HTMLVideoElement | null>(null);
	const replacementHlsInstance = ref<any>(null);
	const currentFileId = ref<string | null>(null);
	const currentFileType = ref<string | null>(null);

	// Load file data to get type/mimetype
	const loadFileDataForReplacement = async (fileId: string) => {
		try {
			const response = await api.get(`/files/${fileId}`);
			const file = response.data.data;
			currentFileType.value = file.type || 'video/mp4';
		} catch (error) {
			console.error('Failed to load file data for replacement player:', error);
			currentFileType.value = 'video/mp4'; // Default fallback
		}
	};

	// Update replacement player based on current format
	const updateReplacementPlayer = () => {
		if (!replacementVideoElement.value) return;
		
		// Cleanup existing HLS instance
		if (replacementHlsInstance.value) {
			replacementHlsInstance.value.destroy();
			replacementHlsInstance.value = null;
		}
		
		// Clear video src
		replacementVideoElement.value.src = '';
		replacementVideoElement.value.removeAttribute('src');
		
		if (useHls.value) {
			// Switch to HLS
			const streamUrl = streamUrlFromValue.value;
			if (streamUrl) {
				setupHlsPlayer(replacementVideoElement.value, streamUrl);
			}
		} else {
			// Switch to File
			const mp4 = mp4Url.value;
			if (mp4) {
				replacementVideoElement.value.src = mp4;
				replacementVideoElement.value.load();
			}
		}
		
		// Update info overlay
		updateReplacementPlayerInfo();
	};

	// Update info overlay content
	const updateReplacementPlayerInfo = () => {
		const container = document.querySelector('.file-preview');
		if (!container) return;
		
		const infoOverlay = container.querySelector('.replacement-player-info');
		if (!infoOverlay) return;
		
		// Get filename from string field value (m3u8 path)
		const filename = props.value && typeof props.value === 'string' ? props.value.split('/').pop() : '';
		
		infoOverlay.innerHTML = `
			<div style="color: var(--theme--foreground-inverse-subdued, rgba(255, 255, 255, 0.7)); font-size: 12px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
				${filename ? `<span style="font-weight: 500;">${filename}</span>` : ''}
				${useHls.value ? '<span class="hls-label" style="background: var(--theme--primary, #6644ff); color: var(--white, #fff); padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 11px;">HLS</span>' : ''}
			</div>
		`;
	};

	// Add info overlay to replacement player
	const addInfoOverlayToReplacementPlayer = (container: Element) => {
		// Check if info overlay already exists
		let infoOverlay = container.querySelector('.replacement-player-info') as HTMLElement | null;
		
		if (!infoOverlay) {
			// Create info overlay
			infoOverlay = document.createElement('div');
			infoOverlay.className = 'replacement-player-info';
			infoOverlay.style.cssText = `
				position: absolute;
				inset-block-start: 0;
				inset-inline-start: 0;
				z-index: 3;
				padding: 12px;
				line-height: 1.2;
				opacity: 0;
				visibility: hidden;
				transition: opacity 0.2s ease, visibility 0.2s ease;
				pointer-events: none;
			`;
			
			// Add hover effect to show info
			const videoContainer = (container.querySelector('.video-container-wrapper') || container) as HTMLElement;
			if (videoContainer) {
				videoContainer.addEventListener('mouseenter', () => {
					if (infoOverlay) {
						(infoOverlay as HTMLElement).style.opacity = '1';
						(infoOverlay as HTMLElement).style.visibility = 'visible';
					}
				});
				videoContainer.addEventListener('mouseleave', () => {
					if (infoOverlay) {
						(infoOverlay as HTMLElement).style.opacity = '0';
						(infoOverlay as HTMLElement).style.visibility = 'hidden';
					}
				});
			}
			
			container.appendChild(infoOverlay);
		}
		
		// Update info content
		updateReplacementPlayerInfo();
	};

	// Add toggle button to file preview container
	const addToggleButtonToFilePreview = (container: Element, togglePlaybackFormat: () => void) => {
		// Check if toggle button already exists
		const existingContainer = container.querySelector('.format-toggle-container');
		if (existingContainer) {
			// Update existing button text
			const existingButton = existingContainer.querySelector('.format-toggle') as HTMLButtonElement;
			if (existingButton) {
				existingButton.textContent = useHls.value ? 'Switch to File' : 'Switch to HLS';
			}
			return;
		}
		
		// Create toggle button container
		const toggleContainer = document.createElement('div');
		toggleContainer.className = 'format-toggle-container';
		toggleContainer.style.cssText = 'display: flex; justify-content: flex-end; margin-block-start: 12px; position: absolute; right: 0;';
		
		const toggleButton = document.createElement('button');
		toggleButton.className = 'format-toggle';
		toggleButton.textContent = useHls.value ? 'Switch to File' : 'Switch to HLS';
		toggleButton.style.cssText = 'color: var(--theme--primary); cursor: pointer; font-weight: 600; background: none; border: none; padding: 0;';
		
		// Create click handler that updates button text
		const clickHandler = () => {
			togglePlaybackFormat();
			// Update button text after toggle
			toggleButton.textContent = useHls.value ? 'Switch to File' : 'Switch to HLS';
		};
		
		toggleButton.addEventListener('click', clickHandler);
		
		toggleContainer.appendChild(toggleButton);
		container.appendChild(toggleContainer);
	};

	// Replace the default file-preview video player with our HLS player
	const replaceDefaultVideoPlayer = () => {
		// Get file ID for MP4 fallback
		currentFileId.value = getFileIdFromContext(attrs);
		
		// Wait a bit for the DOM to be ready
		setTimeout(() => {
			// Look for video elements in file-preview components
			const filePreviewContainer = document.querySelector('.file-preview');
			if (!filePreviewContainer) {
				// Try again after a short delay
				setTimeout(replaceDefaultVideoPlayer, 100);
				return;
			}
			
			const defaultVideo = filePreviewContainer.querySelector('video');
			if (!defaultVideo) {
				return;
			}
			
			// Check if we already replaced it
			if (defaultVideo.dataset.replacedByHls === 'true') {
				// Already replaced, just update if needed
				updateReplacementPlayer();
				return;
			}
			
			// Get the stream URL
			const streamUrl = streamUrlFromValue.value;
			if (!streamUrl) {
				// If no stream URL, try to use MP4 directly
				const mp4 = mp4Url.value;
				if (mp4 && !useHls.value) {
					// Store reference to the original video element
					replacementVideoElement.value = defaultVideo as HTMLVideoElement;
					defaultVideo.dataset.replacedByHls = 'true';
					defaultVideo.src = mp4;
					defaultVideo.load();
					return;
				}
				return;
			}
			
			// Store reference to the original video element
			replacementVideoElement.value = defaultVideo as HTMLVideoElement;
			
			// Mark as replaced
			defaultVideo.dataset.replacedByHls = 'true';
			
			// Clear the src to stop loading
			defaultVideo.src = '';
			defaultVideo.removeAttribute('src');
			
			// Remove any poster attribute to prevent 404 errors
			defaultVideo.removeAttribute('poster');
			defaultVideo.poster = '';
			
			// Ensure video element has full width styling from the start
			const videoEl = defaultVideo as HTMLVideoElement;
			videoEl.style.width = '100%';
			videoEl.style.height = 'auto';
			videoEl.style.display = 'block';
			videoEl.style.aspectRatio = '16 / 9';
			videoEl.style.maxWidth = '100%';
			videoEl.style.minWidth = '100%';
			videoEl.style.objectFit = 'contain';
			
			// Make video container relative for absolute positioning of overlay
			const videoContainer = videoEl.parentElement;
			if (videoContainer && !videoContainer.classList.contains('video-container-wrapper')) {
				videoContainer.style.position = 'relative';
				videoContainer.style.width = '100%';
				videoContainer.style.maxWidth = '100%';
				videoContainer.classList.add('video-container-wrapper');
			}
			
			// Ensure full width is maintained when HLS metadata loads or quality changes
			const ensureFullWidth = () => {
				// Force full width on video element
				videoEl.style.width = '100%';
				videoEl.style.maxWidth = '100%';
				videoEl.style.minWidth = '100%';
				
				// Ensure container is also full width
				if (videoContainer) {
					videoContainer.style.width = '100%';
					videoContainer.style.maxWidth = '100%';
				}
				
				// Force a reflow to ensure styles are applied
				void videoEl.offsetWidth;
			};
			
			// For HLS.js, create a custom HLS instance to track level changes
			if (Hls.isSupported()) {
				// Create HLS instance specifically for replacement player to track events
				const hls = new Hls({
					enableWorker: true,
					lowLatencyMode: true,
					backBufferLength: 90,
					autoStartLoad: true,
					maxBufferLength: 3,
					maxMaxBufferLength: 6,
					maxBufferSize: 60 * 1000 * 1000
				});
				
				hls.loadSource(streamUrl);
				hls.attachMedia(videoEl);
				
				// Store HLS instance for cleanup
				replacementHlsInstance.value = hls;
				
				// Listen for level changes (quality switches) - this is the key fix
				hls.on(Hls.Events.LEVEL_SWITCHED, () => {
					ensureFullWidth();
					// Also trigger after a delay to ensure layout has updated
					setTimeout(ensureFullWidth, 50);
				});
				
				hls.on(Hls.Events.LEVEL_LOADED, () => {
					ensureFullWidth();
				});
				
				// Listen for manifest parsed to ensure initial sizing
				hls.on(Hls.Events.MANIFEST_PARSED, () => {
					ensureFullWidth();
					setTimeout(ensureFullWidth, 100);
				});
				
				// Add play event listener
				const onPlayHandler = () => {
					if (hls) {
						hls.startLoad();
						videoEl.removeEventListener('play', onPlayHandler);
					}
				};
				videoEl.addEventListener('play', onPlayHandler);
			} else {
				// For native HLS (Safari), use the setupHlsPlayer
				setupHlsPlayer(videoEl, streamUrl);
			}
			
			// Hide the default video's loading spinner
			videoEl.setAttribute('preload', 'none');
			
			// Listen for metadata loaded to ensure proper sizing (for both HLS.js and native)
			videoEl.addEventListener('loadedmetadata', () => {
				ensureFullWidth();
				// Also trigger after a small delay to catch any layout shifts
				setTimeout(ensureFullWidth, 100);
			});
			
			videoEl.addEventListener('loadeddata', () => {
				ensureFullWidth();
			});
			
			// Listen for resize events (when quality changes might cause dimension changes)
			videoEl.addEventListener('resize', ensureFullWidth);
			
			// Load file data to get type
			if (currentFileId.value) {
				loadFileDataForReplacement(currentFileId.value);
			}
			
			// Add info overlay
			addInfoOverlayToReplacementPlayer(filePreviewContainer);
			
			// Add toggle button below the player
			addToggleButtonToFilePreview(filePreviewContainer, () => {
				useHls.value = !useHls.value;
				updateReplacementPlayer();
				// Update toggle button text in file preview
				const toggleButton = filePreviewContainer.querySelector('.format-toggle') as HTMLButtonElement;
				if (toggleButton) {
					toggleButton.textContent = useHls.value ? 'Switch to File' : 'Switch to HLS';
				}
			});
		}, 100);
	};

	// Cleanup replacement player
	const cleanupReplacementPlayer = () => {
		if (replacementHlsInstance.value) {
			replacementHlsInstance.value.destroy();
			replacementHlsInstance.value = null;
		}
		if (replacementVideoElement.value) {
			replacementVideoElement.value.dataset.replacedByHls = 'false';
			replacementVideoElement.value = null;
		}
	};

	const togglePlaybackFormat = (videoElement: Ref<HTMLVideoElement | null>, setupVideoPlayer: () => void) => {
		useHls.value = !useHls.value;
		
		if (shouldReplaceDefaultPlayer.value && replacementVideoElement.value) {
			// Replacing default player - update the replacement video
			updateReplacementPlayer();
			// Update toggle button text in file preview
			const filePreviewContainer = document.querySelector('.file-preview');
			if (filePreviewContainer) {
				const toggleButton = filePreviewContainer.querySelector('.format-toggle') as HTMLButtonElement;
				if (toggleButton) {
					toggleButton.textContent = useHls.value ? 'Switch to File' : 'Switch to HLS';
				}
			}
		} else if (videoElement.value) {
			// Our own player - update it
			// Update preload attribute based on format
			const preloadValue = useHls.value ? 'none' : 'metadata';
			videoElement.value.setAttribute('preload', preloadValue);
			videoElement.value.preload = preloadValue;
			setupVideoPlayer();
		}
	};

	return {
		replacementVideoElement,
		replacementHlsInstance,
		currentFileId,
		currentFileType,
		mp4Url,
		replaceDefaultVideoPlayer,
		updateReplacementPlayer,
		cleanupReplacementPlayer,
		togglePlaybackFormat
	};
}

