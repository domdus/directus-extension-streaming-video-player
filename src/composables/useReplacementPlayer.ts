/**
 * Composable for replacement player DOM manipulation logic
 */
import { ref, type Ref } from 'vue';
import Hls from 'hls.js';
import * as dashjs from 'dashjs';
import { getFileIdFromContext } from '../utils';
import type { useApi } from '@directus/extensions-sdk';
import { isDashStream } from './useDashPlayer';

export function useReplacementPlayer(
	props: any,
	attrs: any,
	api: ReturnType<typeof useApi>,
	shouldReplaceDefaultPlayer: Ref<boolean>,
	streamUrlFromValue: Ref<string | null>,
	useHls: Ref<boolean>,
	setupHlsPlayer: (videoEl: HTMLVideoElement, streamUrl: string, fallback?: () => void) => void,
	setupDashPlayer: (videoEl: HTMLVideoElement, streamUrl: string, fallback?: () => void) => void,
	mp4Url: Ref<string | null>
) {
	const replacementVideoElement = ref<HTMLVideoElement | null>(null);
	const replacementHlsInstance = ref<any>(null);
	const replacementDashInstance = ref<dashjs.MediaPlayerClass | null>(null);
	const replacementQuality = ref<string | null>(null);
	const currentFileId = ref<string | null>(null);
	const currentFileType = ref<string | null>(null);

	// Format quality height to display string
	const formatQuality = (height: number | undefined): string | null => {
		if (!height) return null;
		if (height >= 2160) return '4K';
		if (height >= 1440) return '1440p';
		if (height >= 1080) return '1080p';
		if (height >= 720) return '720p';
		if (height >= 480) return '480p';
		if (height >= 360) return '360p';
		if (height >= 240) return '240p';
		return `${height}p`;
	};

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
		
		// Cleanup existing DASH instance
		if (replacementDashInstance.value) {
			try {
				replacementDashInstance.value.reset();
				replacementDashInstance.value.destroy();
			} catch (error) {
				console.warn('[ReplacementPlayer] Error cleaning up DASH:', error);
			}
			replacementDashInstance.value = null;
		}
		
		// Reset quality
		replacementQuality.value = null;
		
		// Clear video src
		replacementVideoElement.value.src = '';
		replacementVideoElement.value.removeAttribute('src');
		
		if (useHls.value) {
			// Switch to streaming format (HLS or DASH)
			const streamUrl = streamUrlFromValue.value;
			if (streamUrl && replacementVideoElement.value) {
				const videoEl = replacementVideoElement.value;
				
				if (isDashStream(streamUrl)) {
					// Create DASH instance with quality tracking
					try {
						const dashPlayer = dashjs.MediaPlayer().create();
						dashPlayer.updateSettings({
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
									initialBitrate: { audio: -1, video: -1 }
								}
							}
						});

						const updateDashQuality = () => {
							try {
								const playerAny = dashPlayer as any;
								const videoRepresentations = playerAny.getRepresentationsForType?.('video');
								if (!videoRepresentations || videoRepresentations.length === 0) return;
								const currentQualityIndex = playerAny.getQualityFor?.('video') ?? -1;
								if (currentQualityIndex >= 0 && currentQualityIndex < videoRepresentations.length) {
									replacementQuality.value = formatQuality(videoRepresentations[currentQualityIndex].height);
								} else if (videoRepresentations.length > 0) {
									const sortedReps = [...videoRepresentations].sort((a: any, b: any) => (b.height || 0) - (a.height || 0));
									replacementQuality.value = formatQuality(sortedReps[0].height);
								}
								updateReplacementPlayerInfo();
							} catch (error) {
								console.warn('[ReplacementPlayer] Error updating DASH quality:', error);
							}
						};

						const Events = dashjs.MediaPlayer.events;
						if (Events) {
							if (Events.STREAM_INITIALIZED) {
								dashPlayer.on(Events.STREAM_INITIALIZED, () => {
									setTimeout(updateDashQuality, 200);
								});
							}
							if (Events.QUALITY_CHANGE_RENDERED) {
								dashPlayer.on(Events.QUALITY_CHANGE_RENDERED, updateDashQuality);
							}
						}

						dashPlayer.initialize(videoEl, streamUrl, false);
						replacementDashInstance.value = dashPlayer;
						
						videoEl.addEventListener('loadedmetadata', () => {
							setTimeout(updateDashQuality, 300);
						});
						setTimeout(updateDashQuality, 1000);
					} catch (error) {
						console.error('[ReplacementPlayer] Error setting up DASH:', error);
						setupDashPlayer(videoEl, streamUrl);
					}
				} else {
					// Create HLS instance with quality tracking
					if (Hls.isSupported()) {
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
						replacementHlsInstance.value = hls;
						
						const updateHlsQuality = () => {
							if (hls.levels && hls.levels.length > 0) {
								const currentLevelIndex = hls.currentLevel;
								if (currentLevelIndex >= 0 && currentLevelIndex < hls.levels.length) {
									replacementQuality.value = formatQuality(hls.levels[currentLevelIndex].height);
								} else if (hls.levels.length > 0) {
									const sortedLevels = [...hls.levels].sort((a, b) => (b.height || 0) - (a.height || 0));
									replacementQuality.value = formatQuality(sortedLevels[0].height);
								}
								updateReplacementPlayerInfo();
							}
						};

						hls.on(Hls.Events.LEVEL_SWITCHED, updateHlsQuality);
						hls.on(Hls.Events.LEVEL_LOADED, updateHlsQuality);
						hls.on(Hls.Events.MANIFEST_PARSED, () => {
							setTimeout(updateHlsQuality, 100);
						});
						
						const onPlayHandler = () => {
							if (hls) {
								hls.startLoad();
								videoEl.removeEventListener('play', onPlayHandler);
							}
						};
						videoEl.addEventListener('play', onPlayHandler);
					} else {
						setupHlsPlayer(videoEl, streamUrl);
					}
				}
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
		
		const streamUrl = streamUrlFromValue.value;
		const isDash = streamUrl ? isDashStream(streamUrl) : false;
		// Always show stream label when we have a stream URL and useHls is true
		const streamLabel = (useHls.value && streamUrl) ? (isDash ? 'DASH' : 'HLS') : '';
		const qualityLabel = replacementQuality.value || '';
		
		// Build the content
		const contentParts = [];
		if (filename) {
			contentParts.push(`<span style="font-weight: 500;">${filename}</span>`);
		}
		if (streamLabel) {
			contentParts.push(`<span class="${isDash ? 'dash' : 'hls'}-label" style="background: var(--theme--primary, #6644ff); color: var(--white, #fff); padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 11px;">${streamLabel}</span>`);
		}
		if (qualityLabel) {
			contentParts.push(`<span class="quality-label" style="background: var(--theme--primary, #6644ff); color: var(--white, #fff); padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 11px;">${qualityLabel}</span>`);
		}
		
		infoOverlay.innerHTML = `
			<div style="color: var(--theme--foreground-inverse-subdued, rgba(255, 255, 255, 0.7)); font-size: 12px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
				${contentParts.join('')}
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
				existingButton.textContent = useHls.value ? 'Switch to File' : 'Switch to Stream';
			}
			return;
		}
		
		// Create toggle button container
		const toggleContainer = document.createElement('div');
		toggleContainer.className = 'format-toggle-container';
		toggleContainer.style.cssText = 'display: flex; justify-content: flex-end; margin-block-start: 12px; position: absolute; right: 0;';
		
		const toggleButton = document.createElement('button');
		toggleButton.className = 'format-toggle';
		toggleButton.textContent = useHls.value ? 'Switch to File' : 'Switch to Stream';
		toggleButton.style.cssText = 'color: var(--theme--primary); cursor: pointer; font-weight: 600; background: none; border: none; padding: 0;';
		
		// Create click handler that updates button text
		const clickHandler = () => {
			togglePlaybackFormat();
			// Update button text after toggle
			toggleButton.textContent = useHls.value ? 'Switch to File' : 'Switch to Stream';
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
			
			// Check if it's a DASH stream
			if (isDashStream(streamUrl)) {
				// Create DASH instance for replacement player to track quality
				try {
					const dashPlayer = dashjs.MediaPlayer().create();
					
					// Configure player settings
					dashPlayer.updateSettings({
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

					// Helper to update quality for replacement DASH player
					const updateReplacementDashQuality = () => {
						try {
							const playerAny = dashPlayer as any;
							const videoRepresentations = playerAny.getRepresentationsForType?.('video');
							if (!videoRepresentations || videoRepresentations.length === 0) return;

							const currentQualityIndex = playerAny.getQualityFor?.('video') ?? -1;
							
							if (currentQualityIndex >= 0 && currentQualityIndex < videoRepresentations.length) {
								const currentRep = videoRepresentations[currentQualityIndex];
								replacementQuality.value = formatQuality(currentRep.height);
							} else if (videoRepresentations.length > 0) {
								const sortedReps = [...videoRepresentations].sort((a: any, b: any) => (b.height || 0) - (a.height || 0));
								replacementQuality.value = formatQuality(sortedReps[0].height);
							}
							updateReplacementPlayerInfo();
						} catch (error) {
							console.warn('[ReplacementPlayer] Error updating DASH quality:', error);
						}
					};

					// Set up event listeners for quality tracking
					const Events = dashjs.MediaPlayer.events;
					if (Events) {
						if (Events.STREAM_INITIALIZED) {
							dashPlayer.on(Events.STREAM_INITIALIZED, () => {
								setTimeout(() => {
									updateReplacementDashQuality();
								}, 200);
							});
						}
						if (Events.QUALITY_CHANGE_RENDERED) {
							dashPlayer.on(Events.QUALITY_CHANGE_RENDERED, () => {
								updateReplacementDashQuality();
							});
						}
					}

					// Initialize player
					dashPlayer.initialize(videoEl, streamUrl, false);
					
					// Store instance
					replacementDashInstance.value = dashPlayer;
					
					// Listen for video events to update quality
					videoEl.addEventListener('loadedmetadata', () => {
						setTimeout(() => {
							updateReplacementDashQuality();
						}, 300);
					});
					
					videoEl.addEventListener('playing', () => {
						setTimeout(() => {
							updateReplacementDashQuality();
						}, 500);
					});
					
					// Initial quality check
					setTimeout(() => {
						updateReplacementDashQuality();
					}, 1000);
				} catch (error) {
					console.error('[ReplacementPlayer] Error setting up DASH:', error);
					// Fallback to setupDashPlayer
					setupDashPlayer(videoEl, streamUrl);
				}
			} else if (Hls.isSupported()) {
				// For HLS.js, create a custom HLS instance to track level changes
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
				
				// Helper to update quality for replacement player
				const updateReplacementQuality = () => {
					if (hls.levels && hls.levels.length > 0) {
						const currentLevelIndex = hls.currentLevel;
						if (currentLevelIndex >= 0 && currentLevelIndex < hls.levels.length) {
							const level = hls.levels[currentLevelIndex];
							replacementQuality.value = formatQuality(level.height);
						} else if (hls.levels.length > 0) {
							const sortedLevels = [...hls.levels].sort((a, b) => (b.height || 0) - (a.height || 0));
							replacementQuality.value = formatQuality(sortedLevels[0].height);
						}
						updateReplacementPlayerInfo();
					}
				};

				// Listen for level changes (quality switches) - this is the key fix
				hls.on(Hls.Events.LEVEL_SWITCHED, () => {
					ensureFullWidth();
					updateReplacementQuality();
					// Also trigger after a delay to ensure layout has updated
					setTimeout(ensureFullWidth, 50);
				});
				
				hls.on(Hls.Events.LEVEL_LOADED, () => {
					ensureFullWidth();
					updateReplacementQuality();
				});
				
				// Listen for manifest parsed to ensure initial sizing
				hls.on(Hls.Events.MANIFEST_PARSED, () => {
					ensureFullWidth();
					setTimeout(() => {
						ensureFullWidth();
						updateReplacementQuality();
					}, 100);
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
			
			// Update info overlay after a short delay to ensure player is initialized
			setTimeout(() => {
				updateReplacementPlayerInfo();
			}, 500);
			
			// Add toggle button below the player
			addToggleButtonToFilePreview(filePreviewContainer, () => {
				useHls.value = !useHls.value;
				updateReplacementPlayer();
				// Update toggle button text in file preview
				const toggleButton = filePreviewContainer.querySelector('.format-toggle') as HTMLButtonElement;
				if (toggleButton) {
					toggleButton.textContent = useHls.value ? 'Switch to File' : 'Switch to Stream';
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
		if (replacementDashInstance.value) {
			try {
				replacementDashInstance.value.reset();
				replacementDashInstance.value.destroy();
			} catch (error) {
				console.warn('[ReplacementPlayer] Error cleaning up DASH:', error);
			}
			replacementDashInstance.value = null;
		}
		if (replacementVideoElement.value) {
			replacementVideoElement.value.dataset.replacedByHls = 'false';
			replacementVideoElement.value = null;
		}
		
		// Reset quality
		replacementQuality.value = null;
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
					toggleButton.textContent = useHls.value ? 'Switch to File' : 'Switch to Stream';
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

