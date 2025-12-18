<template>
	<div class="video-player-interface">
		<!-- For string fields: show input only when null or editing -->
		<StringFieldSection
			v-if="isStringField"
			ref="stringFieldRef"
			:value="value"
			:editing-value="editingValue"
			:is-editing-string-field="isEditingStringField"
			:is-file-module="isFileModule"
			:should-replace-default-player="shouldReplaceDefaultPlayer"
			:stream-url-from-value="streamUrlFromValue"
			:video-preload="videoPreload"
			:use-hls="useHls"
			:current-quality="currentQuality"
			:csp-error="cspError"
			:disabled="disabled"
			:input-options="inputOptions"
			:input-placeholder="inputPlaceholder"
			:processed-value="processedValue"
			@update:value="handleStringInput"
			@focus="startEditing"
			@blur="finishEditing"
			@loaded="onVideoLoaded"
			@fullscreen="openFullscreen"
			@edit="editStringField"
			@clear="clearStringField"
			@toggle-format="togglePlaybackFormat"
		/>

		<!-- For file fields: show upload area when empty, player when has value (NO input field) -->
		<FileFieldSection
			v-else-if="!isStringField"
			ref="fileFieldRef"
			:value="value"
			:file-data="fileData"
			:should-replace-default-player="shouldReplaceDefaultPlayer"
			:is-video-file="isVideoFile"
			:video-preload="videoPreload"
			:poster-url="posterUrl"
			:download-url="downloadUrl"
			:stream-link-field-name="streamLinkFieldName"
			:current-quality="currentQuality"
			:csp-error="cspError"
			:create-allowed="createAllowed"
			:enable-create-value="enableCreateValue"
			:enable-select-value="enableSelectValue"
			:folder="folder"
			:custom-filter="customFilter"
			@upload="onUpload"
			@loaded="onVideoLoaded"
			@fullscreen="openFullscreen"
			@edit="openEditDialog"
			@clear="clearFile"
		/>

		<!-- Edit Drawer -->
		<FileEditDrawer
			ref="editDrawerRef"
			:file-data="fileData"
			:download-url="downloadUrl"
			:disabled="disabled"
			:value="value"
			@update="update"
		/>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick, useAttrs, inject } from 'vue';
import { useApi } from '@directus/extensions-sdk';
import { useStreamUrl } from './composables/useStreamUrl';
import { useHlsPlayer } from './composables/useHlsPlayer';
import { useDashPlayer } from './composables/useDashPlayer';
import { useInputOptions } from './composables/useInputOptions';
import { useFileData } from './composables/useFileData';
import { useFieldDetection } from './composables/useFieldDetection';
import { useStringFieldHandlers } from './composables/useStringFieldHandlers';
import { useVideoPlayerSetup } from './composables/useVideoPlayerSetup';
import { useReplacementPlayer } from './composables/useReplacementPlayer';
import StringFieldSection from './components/StringFieldSection.vue';
import FileFieldSection from './components/FileFieldSection.vue';
import FileEditDrawer from './components/FileEditDrawer.vue';

interface FileInfo {
	id: string;
	title?: string;
	type?: string;
	filename_download?: string;
}

const props = withDefaults(
	defineProps<{
		value: string | null;
		collection: string;
		field: string;
		disabled?: boolean;
		loading?: boolean;
		width?: string;
		fieldMeta?: any;
		item?: any;
		folder?: string;
		filter?: any;
		enableCreate?: boolean;
		enableSelect?: boolean;
		options?: {
			stream_secret?: string;
			host_url?: string;
			url_schema?: string;
			include_ip?: boolean;
			expires_in_minutes?: number;
			placeholder?: string;
			iconLeft?: string;
			iconRight?: string;
			softLength?: number;
			font?: 'sans-serif' | 'serif' | 'monospace';
			trim?: boolean;
			masked?: boolean;
			clear?: boolean;
			slug?: boolean;
		};
	}>(),
	{
		enableCreate: true,
		enableSelect: true,
	}
);

const emit = defineEmits<{
	(e: 'input', value: string | null): void;
}>();

const api = useApi();
const attrs = useAttrs();
const values = inject('values', ref<Record<string, unknown>>({}));

// Core refs
const videoElement = ref<HTMLVideoElement | null>(null);
const stringFieldRef = ref<InstanceType<typeof StringFieldSection> | null>(null);
const fileFieldRef = ref<InstanceType<typeof FileFieldSection> | null>(null);
const editDrawerRef = ref<InstanceType<typeof FileEditDrawer> | null>(null);
const useHls = ref(true);

// Timeout for src check watcher
let srcCheckTimeout: ReturnType<typeof setTimeout> | null = null;

// Composables
const { fileData, loading, loadFileData, clearFileData } = useFileData();
const { inputOptions, inputPlaceholder, processValue } = useInputOptions(attrs);
const { hlsInstance, playEventListener, currentQuality: hlsQuality, cspError: hlsCspError, setupHlsPlayer, cleanupHls } = useHlsPlayer(videoElement);
const { dashInstance, currentQuality: dashQuality, cspError: dashCspError, setupDashPlayer, cleanupDash } = useDashPlayer(videoElement);

// Combine CSP errors from both HLS and DASH players
const cspError = computed(() => hlsCspError.value || dashCspError.value);
const { getStreamUrl, apiBaseUrl } = useStreamUrl({
	api,
	hostUrl: attrs.host_url as string,
	urlSchema: attrs.url_schema as string,
	streamSecret: attrs.stream_secret as string,
	includeIp: attrs.include_ip as boolean,
	expiresInMinutes: attrs.expires_in_minutes as number
});

// Combine quality from both HLS and DASH players
const currentQuality = computed(() => {
	return hlsQuality.value || dashQuality.value || null;
});

// Get stream link field name
const streamLinkFieldName = computed(() => {
	return (attrs.stream_link_field_name as string) || '';
});

// Field detection and computed properties
const {
	isStringField,
	isFileModule,
	shouldReplaceDefaultPlayer,
	isVideoFile,
	streamUrlFromValue,
	mp4Url: mp4UrlComputed,
	posterUrl,
	videoUrl,
	downloadUrl,
	folder,
	enableSelectValue,
	enableCreateValue,
	createAllowed,
	customFilter
} = useFieldDetection(
	props,
	attrs,
	fileData,
	streamLinkFieldName,
	getStreamUrl,
	apiBaseUrl,
	values
);

// String field handlers
const {
	isEditingStringField,
	editingValue,
	editStringField,
	startEditing,
	clearStringField,
	handleStringInput,
	finishEditing,
	resetEditingState
} = useStringFieldHandlers(props, emit, inputOptions, processValue);

// Replacement player logic
const {
	replacementVideoElement,
	currentFileId,
	mp4Url,
	replaceDefaultVideoPlayer,
	updateReplacementPlayer,
	cleanupReplacementPlayer,
	togglePlaybackFormat: togglePlaybackFormatFn
} = useReplacementPlayer(
	props,
	attrs,
	api,
	shouldReplaceDefaultPlayer,
	streamUrlFromValue,
	useHls,
	setupHlsPlayer,
	setupDashPlayer,
	mp4UrlComputed
);

// Video player setup
const {
	videoPreload,
	setupVideoPlayer,
	openFullscreen,
	onVideoLoaded
} = useVideoPlayerSetup(
	videoElement,
	setupHlsPlayer,
	cleanupHls,
	setupDashPlayer,
	cleanupDash,
	isStringField,
	shouldReplaceDefaultPlayer,
	streamUrlFromValue,
	useHls,
	mp4Url,
	fileData,
	streamLinkFieldName,
	getStreamUrl,
	videoUrl
);

// Sync videoElement from child components - ONLY for regular interface cases (not replacement player)
watch([stringFieldRef, fileFieldRef], () => {
	// Skip sync for replacement player case - it uses DOM manipulation instead
	if (shouldReplaceDefaultPlayer.value) {
		return;
	}
	
	nextTick(() => {
		// For string fields, check if video element is now available
		if (isStringField.value && stringFieldRef.value?.videoElement) {
			videoElement.value = stringFieldRef.value.videoElement;
			// Setup player after video element is synced
			if (props.value && streamUrlFromValue.value) {
				setupVideoPlayer();
			}
		} else if (!isStringField.value && fileFieldRef.value?.videoElement) {
			videoElement.value = fileFieldRef.value.videoElement;
			// Setup player after video element is synced
			if (props.value && fileData.value && isVideoFile.value) {
				setupVideoPlayer();
			}
		} else if (isStringField.value && stringFieldRef.value && !stringFieldRef.value.videoElement) {
			// StringFieldSection exists but video element not exposed yet - wait for value and streamUrl
			if (props.value && streamUrlFromValue.value) {
				// Conditions are met, video should render - wait for it
				const retryCount = { count: 0 };
				const checkForVideo = () => {
					retryCount.count++;
					if (stringFieldRef.value?.videoElement) {
						videoElement.value = stringFieldRef.value.videoElement;
						setupVideoPlayer();
					} else if (retryCount.count < 10) {
						setTimeout(checkForVideo, 100);
					}
				};
				setTimeout(checkForVideo, 100);
			}
		} else if (!isStringField.value && fileFieldRef.value && !fileFieldRef.value.videoElement) {
			// FileFieldSection exists but video element not exposed yet - wait for fileData and isVideoFile
			if (props.value && fileData.value && isVideoFile.value) {
				// Conditions are met, video should render - wait for it
				const retryCount = { count: 0 };
				const checkForVideo = () => {
					retryCount.count++;
					if (fileFieldRef.value?.videoElement) {
						videoElement.value = fileFieldRef.value.videoElement;
						setupVideoPlayer();
					} else if (retryCount.count < 10) {
						setTimeout(checkForVideo, 100);
					}
				};
				setTimeout(checkForVideo, 100);
			}
		}
	});
}, { immediate: true });

// Watch for fileFieldRef videoElement changes specifically (handles re-renders after flows)
watch(() => fileFieldRef.value?.videoElement, (newVideoEl, oldVideoEl) => {
	// Skip for replacement player case
	if (shouldReplaceDefaultPlayer.value) {
		return;
	}
	
	// Skip for string fields
	if (isStringField.value) {
		return;
	}
	
	// Don't initialize player while user is editing - wait until they save
	if (isEditingStringField.value) {
		return;
	}
	
	// If video element changed and we have the necessary data, reinitialize
	if (newVideoEl && newVideoEl !== oldVideoEl && props.value && fileData.value && isVideoFile.value) {
		videoElement.value = newVideoEl;
		nextTick(() => {
			setupVideoPlayer();
		});
	}
});

// Watch for videoElement to become available and setup player - ONLY for regular interface cases
watch(videoElement, (newElement) => {
	// Skip for replacement player case
	if (shouldReplaceDefaultPlayer.value) {
		return;
	}
	
	if (newElement && props.value) {
		if (isStringField.value) {
			// String field - setup player
			nextTick(() => {
				if (videoElement.value && streamUrlFromValue.value) {
					setupVideoPlayer();
				}
			});
		} else if (!isStringField.value && fileData.value) {
			// File field - setup player
			nextTick(() => {
				if (videoElement.value) {
					setupVideoPlayer();
				}
			});
		}
	}
}, { immediate: true });

// Watch for streamUrlFromValue changes to re-setup player for string fields - ONLY for regular interface cases
watch(streamUrlFromValue, (newStreamUrl) => {
	// Skip for replacement player case
	if (shouldReplaceDefaultPlayer.value) {
		return;
	}
	
	// Don't initialize player while user is editing - wait until they save
	if (isEditingStringField.value) {
		return;
	}
	
	if (isStringField.value && videoElement.value && newStreamUrl) {
		nextTick(() => {
			setupVideoPlayer();
		});
	}
});

// Watch for fileData changes to re-setup player for file fields - handles flow updates
watch(fileData, (newFileData, oldFileData) => {
	// Skip for replacement player case
	if (shouldReplaceDefaultPlayer.value) {
		return;
	}
	
	// Skip for string fields
	if (isStringField.value) {
		return;
	}
	
	// Reinitialize if fileData exists and we have a video element
	if (newFileData && isVideoFile.value) {
		// Check if fileData changed (different ID or different stream link)
		const fileDataChanged = !oldFileData || 
			oldFileData.id !== newFileData.id ||
			(streamLinkFieldName.value && oldFileData[streamLinkFieldName.value] !== newFileData[streamLinkFieldName.value]);
		
		// Also check if video element has lost its src (even if fileData didn't change)
		const currentVideoEl = fileFieldRef.value?.videoElement || videoElement.value;
		const hasSrc = currentVideoEl && (
			currentVideoEl.src || 
			currentVideoEl.getAttribute('src') || 
			currentVideoEl.querySelector('source')?.getAttribute('src') ||
			hlsInstance.value?.url
		);
		
		// Reinitialize if fileData changed OR if video element has no src
		if (fileDataChanged || !hasSrc) {
			nextTick(() => {
				// Re-sync video element reference if needed
				if (!videoElement.value && fileFieldRef.value?.videoElement) {
					videoElement.value = fileFieldRef.value.videoElement;
				}
				if (videoElement.value) {
					setupVideoPlayer();
				}
			});
		}
	}
}, { deep: true });

// Watch for item prop changes (e.g., after save-and-stay or flow triggers)
// This handles cases where the item data refreshes but value stays the same
watch(() => props.item, () => {
	// Skip for replacement player case
	if (shouldReplaceDefaultPlayer.value) {
		return;
	}
	
	// Skip for string fields
	if (isStringField.value) {
		return;
	}
	
	// Don't initialize player while user is editing - wait until they save
	if (isEditingStringField.value) {
		return;
	}
	
	// If we have a value and fileData, reinitialize the player
	if (props.value && fileData.value && isVideoFile.value) {
		nextTick(() => {
			// Re-sync video element reference if needed
			if (!videoElement.value && fileFieldRef.value?.videoElement) {
				videoElement.value = fileFieldRef.value.videoElement;
			}
			if (videoElement.value) {
				setupVideoPlayer();
			}
		});
	}
}, { deep: true });

// Watch for video element losing its src (e.g., after flow runs) and reinitialize
// This handles cases where flows cause re-renders and the player loses its src
watch([videoElement, () => props.value, fileData, streamUrlFromValue], () => {
	// Skip for replacement player case
	if (shouldReplaceDefaultPlayer.value) {
		return;
	}
	
	// Don't initialize player while user is editing - wait until they save
	if (isEditingStringField.value) {
		return;
	}
	
	// Debounce the check to avoid excessive calls
	if (srcCheckTimeout) {
		clearTimeout(srcCheckTimeout);
	}
	
	srcCheckTimeout = setTimeout(() => {
		// Check if video element exists but has no src when it should
		const currentVideoElement = videoElement.value || 
			(isStringField.value ? stringFieldRef.value?.videoElement : fileFieldRef.value?.videoElement);
		
		if (currentVideoElement && props.value) {
			const hasSrc = currentVideoElement.src || 
				currentVideoElement.getAttribute('src') || 
				currentVideoElement.querySelector('source')?.getAttribute('src');
			
			// Check if HLS is being used (hlsInstance would have a src)
			const hasHlsSrc = hlsInstance.value?.url;
			
			const shouldHaveSrc = (isStringField.value && streamUrlFromValue.value) || 
				(!isStringField.value && fileData.value && isVideoFile.value);
			
			// If video element should have src but doesn't, reinitialize
			if (shouldHaveSrc && !hasSrc && !hasHlsSrc) {
				nextTick(() => {
					// Re-sync video element reference if needed
					if (isStringField.value && stringFieldRef.value?.videoElement) {
						videoElement.value = stringFieldRef.value.videoElement;
					} else if (!isStringField.value && fileFieldRef.value?.videoElement) {
						videoElement.value = fileFieldRef.value.videoElement;
					}
					
					if (videoElement.value) {
						setupVideoPlayer();
					}
				});
			}
		}
	}, 300); // Debounce by 300ms
}, { immediate: false });

// Watch for useHls changes and update preload attribute
watch(useHls, (newValue) => {
	if (videoElement.value) {
		const preloadValue = newValue ? 'none' : 'metadata';
		videoElement.value.setAttribute('preload', preloadValue);
		videoElement.value.preload = preloadValue;
	}
});

// Watch for value changes (after save) to reset editing state and setup player
watch(() => props.value, (newValue) => {
	const wasEditing = isEditingStringField.value;
	resetEditingState();
	
	// If we were editing and now have a value, setup player after save
	if (wasEditing && !isEditingStringField.value && isStringField.value && newValue && !shouldReplaceDefaultPlayer.value) {
		nextTick(() => {
			if (videoElement.value && streamUrlFromValue.value) {
				setupVideoPlayer();
			}
		});
	}
});

// Process value for display
const processedValue = computed(() => props.value);

// File handlers
const clearFile = () => {
	updateValue(null);
};

const updateValue = (newValue: string | null) => {
	emit('input', newValue);
	if (newValue) {
		loadFileDataAndSetup(newValue);
	} else {
		clearFileData();
		cleanupHls();
		cleanupDash();
	}
};

const loadFileDataAndSetup = async (fileId: string) => {
	const data = await loadFileData(fileId);
	if (data) {
		await nextTick();
		setupVideoPlayer();
	}
};

const onUpload = (fileInfo: FileInfo) => {
	updateValue(fileInfo.id);
};

const openEditDialog = () => {
	if (!fileData.value?.id || !editDrawerRef.value) return;
	editDrawerRef.value.editDrawerActive = true;
};

const update = async (value: string | Record<string, any> | null) => {
	if (typeof value === 'string') {
		updateValue(value);
	} else if (value && typeof value === 'object' && value.id) {
		// When drawer saves, update local fileData immediately with the updated data
		// This ensures the UI reflects changes immediately
		if (fileData.value && fileData.value.id === value.id) {
			// Merge the updated data into existing fileData
			fileData.value = { ...fileData.value, ...value };
		}
		// Also reload to ensure everything is in sync
		await loadFileDataAndSetup(value.id);
	} else {
		updateValue(null);
	}
};

const togglePlaybackFormat = () => {
	togglePlaybackFormatFn(videoElement, setupVideoPlayer);
};

// Watch for value changes and setup player
watch(() => props.value, (newValue) => {
	if (isStringField.value) {
		// Don't initialize player while user is editing - wait until they save
		if (isEditingStringField.value) {
			return;
		}
		
		if (shouldReplaceDefaultPlayer.value) {
			nextTick(() => {
				replaceDefaultVideoPlayer();
			});
		} else {
			cleanupReplacementPlayer();
			if (newValue) {
				const setupWhenReady = (attempt = 0) => {
					// Check if StringFieldSection has exposed the video element
					if (stringFieldRef.value?.videoElement) {
						videoElement.value = stringFieldRef.value.videoElement;
						setupVideoPlayer();
					} else if (videoElement.value) {
						setupVideoPlayer();
					} else {
						if (attempt < 20) { // Try for up to 1 second (20 * 50ms)
							setTimeout(() => setupWhenReady(attempt + 1), 50);
						}
					}
				};
				nextTick(() => {
					setupWhenReady();
				});
			} else {
				cleanupHls();
				cleanupDash();
			}
		}
	} else {
		if (newValue) {
			loadFileData(newValue).then(() => {
				// After file data is loaded, sync video element and setup player
				nextTick(() => {
					// Try to sync video element from FileFieldSection if not already synced
					if (!videoElement.value && fileFieldRef.value?.videoElement) {
						videoElement.value = fileFieldRef.value.videoElement;
					}
					
					if (videoElement.value) {
						setupVideoPlayer();
					} else if (isVideoFile.value) {
						// Retry syncing video element - video should render when fileData and isVideoFile are both true
						const retryCount = { count: 0 };
						const checkForVideo = () => {
							retryCount.count++;
							if (fileFieldRef.value?.videoElement) {
								videoElement.value = fileFieldRef.value.videoElement;
								setupVideoPlayer();
							} else if (retryCount.count < 10) {
								setTimeout(checkForVideo, 100);
							}
						};
						setTimeout(checkForVideo, 100);
					}
				});
			});
		} else {
			fileData.value = null;
			cleanupHls();
			cleanupDash();
		}
	}
}, { immediate: true });

onMounted(() => {
	if (isStringField.value) {
		// Don't initialize player while user is editing - wait until they save
		if (isEditingStringField.value) {
			return;
		}
		
		if (shouldReplaceDefaultPlayer.value) {
			nextTick(() => {
				replaceDefaultVideoPlayer();
			});
		} else {
			if (props.value) {
				const setupWhenReady = () => {
					if (videoElement.value && streamUrlFromValue.value) {
						setupVideoPlayer();
					} else if (videoElement.value) {
						// Video element exists but stream URL not ready yet, wait a bit
						setTimeout(setupWhenReady, 100);
					} else {
						setTimeout(setupWhenReady, 50);
					}
				};
				nextTick(() => {
					setupWhenReady();
				});
			}
		}
	} else {
		if (props.value) {
			loadFileData(props.value).then(() => {
				nextTick(() => {
					if (videoElement.value) {
						setupVideoPlayer();
					}
				});
			});
		}
	}
});

onUnmounted(() => {
	cleanupHls();
	cleanupDash();
	cleanupReplacementPlayer();
	if (srcCheckTimeout) {
		clearTimeout(srcCheckTimeout);
		srcCheckTimeout = null;
	}
});
</script>

<style scoped>
.video-player-interface {
	width: 100%;
}
</style>
