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
			:disabled="disabled"
			:input-options="inputOptions"
			:input-placeholder="inputPlaceholder"
			:processed-value="processedValue"
			@update:value="handleStringInput"
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
			include_ip?: boolean;
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

// Composables
const { fileData, loading, loadFileData, clearFileData } = useFileData();
const { inputOptions, inputPlaceholder, processValue } = useInputOptions(attrs);
const { hlsInstance, playEventListener, setupHlsPlayer, cleanupHls } = useHlsPlayer(videoElement);
const { getStreamUrl, apiBaseUrl } = useStreamUrl({
	api,
	hostUrl: attrs.host_url as string,
	streamSecret: attrs.stream_secret as string,
	includeIp: attrs.include_ip as boolean
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
			if (props.value && fileData.value) {
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

const update = (value: string | Record<string, any> | null) => {
	if (typeof value === 'string') {
		updateValue(value);
	} else if (value && typeof value === 'object' && value.id) {
		updateValue(value.id);
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
	cleanupReplacementPlayer();
});
</script>

<style scoped>
.video-player-interface {
	width: 100%;
}
</style>
