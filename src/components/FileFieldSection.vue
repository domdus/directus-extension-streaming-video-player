<template>
	<div v-if="!shouldReplaceDefaultPlayer">
		<!-- Dropzone/Upload Area when no file is selected -->
		<div v-if="!fileData || !value" class="file-upload-area">
			<v-upload
				from-url
				:from-user="createAllowed && enableCreateValue"
				:from-library="enableSelectValue"
				:folder="folder"
				:filter="customFilter"
				@input="$emit('upload', $event)"
			/>
		</div>

		<!-- Video Player Preview for file fields -->
		<div v-if="fileData && isVideoFile" class="video-preview">
			<div class="video-container">
				<video
					ref="videoElementRef"
					:poster="posterUrl || undefined"
					controls
					:preload="videoPreload"
					class="video-player"
					@loadedmetadata="$emit('loaded')"
				>
					Your browser does not support the video tag.
				</video>
				<div class="shadow"></div>
				<div class="actions">
					<v-button
						v-tooltip="isPlaying ? 'Pause' : 'Play'"
						rounded
						icon
						secondary
						@click="togglePlayPause"
					>
						<v-icon :name="isPlaying ? 'pause' : 'play_arrow'" />
					</v-button>
					<v-button
						v-tooltip="'Fullscreen'"
						rounded
						icon
						secondary
						@click="$emit('fullscreen')"
					>
						<v-icon name="zoom_in" />
					</v-button>
					<v-button
						v-tooltip="'Download'"
						rounded
						icon
						secondary
						:href="downloadUrl"
						:download="fileData?.filename_download || 'video'"
					>
						<v-icon name="download" />
					</v-button>
					<v-button
						v-tooltip="'Edit'"
						rounded
						icon
						secondary
						@click="$emit('edit')"
					>
						<v-icon name="edit" />
					</v-button>
					<v-button
						v-tooltip="'Clear'"
						rounded
						icon
						secondary
						@click="$emit('clear')"
					>
						<v-icon name="close" />
					</v-button>
				</div>
				<div v-if="fileData" class="info">
					<div class="title">{{ fileData.filename_download || fileData.id }}</div>
					<div class="meta">
						<span v-if="fileData.width && fileData.height">
							{{ fileData.width }}x{{ fileData.height }}
						</span>
						<span v-if="fileData.filesize">
							{{ formatFileSize(fileData.filesize) }}
						</span>
						<span v-if="fileData.type">
							{{ fileData.type }}
						</span>
					</div>
					<div class="meta" v-if="fileData && streamLinkFieldName && fileData[streamLinkFieldName]">
						<span v-if="typeof fileData[streamLinkFieldName] === 'string'">
							{{ fileData[streamLinkFieldName].split('/').pop() }}
						</span>
					</div>
					<div class="meta" v-if="fileData && streamLinkFieldName && fileData[streamLinkFieldName]">
						<span v-if="isDash" class="dash-label">
							DASH
						</span>
						<span v-else class="hls-label">
							HLS
						</span>
						<span v-if="currentQuality" class="quality-label">
							{{ currentQuality }}
						</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { formatFileSize } from '../utils';
import type { FileData } from '../composables/useFileData';
import { isDashStream } from '../composables/useDashPlayer';

interface Props {
	value: string | null;
	fileData: FileData | null;
	shouldReplaceDefaultPlayer: boolean;
	isVideoFile: boolean;
	videoPreload: string;
	posterUrl: string | null;
	downloadUrl: string | null;
	streamLinkFieldName: string;
	currentQuality?: string | null;
	createAllowed: boolean;
	enableCreateValue: boolean;
	enableSelectValue: boolean;
	folder: string | null;
	customFilter: any;
}

const props = defineProps<Props>();

defineEmits<{
	upload: [fileInfo: any];
	loaded: [];
	fullscreen: [];
	edit: [];
	clear: [];
}>();
const videoElementRef = ref<HTMLVideoElement | null>(null);
const isPlaying = ref(false);

const togglePlayPause = () => {
	if (!videoElementRef.value) return;
	
	if (videoElementRef.value.paused) {
		videoElementRef.value.play();
		isPlaying.value = true;
	} else {
		videoElementRef.value.pause();
		isPlaying.value = false;
	}
};

const updatePlayState = () => {
	if (videoElementRef.value) {
		isPlaying.value = !videoElementRef.value.paused;
	}
};

const setupEventListeners = () => {
	if (videoElementRef.value) {
		videoElementRef.value.addEventListener('play', updatePlayState);
		videoElementRef.value.addEventListener('pause', updatePlayState);
		videoElementRef.value.addEventListener('ended', () => {
			isPlaying.value = false;
		});
		// Initialize state
		updatePlayState();
	}
};

const removeEventListeners = () => {
	if (videoElementRef.value) {
		videoElementRef.value.removeEventListener('play', updatePlayState);
		videoElementRef.value.removeEventListener('pause', updatePlayState);
		videoElementRef.value.removeEventListener('ended', () => {
			isPlaying.value = false;
		});
	}
};

// Detect if stream is DASH
const isDash = computed(() => {
	if (!props.fileData || !props.streamLinkFieldName) return false;
	const streamLinkValue = props.fileData[props.streamLinkFieldName];
	if (typeof streamLinkValue === 'string') {
		return isDashStream(streamLinkValue);
	}
	return false;
});

// Watch for when video element becomes available and expose it
watch(videoElementRef, (newVal) => {
	if (newVal) {
		setupEventListeners();
	}
}, { immediate: true });

onMounted(() => {
	nextTick(() => {
		setupEventListeners();
	});
});

onUnmounted(() => {
	removeEventListeners();
});

defineExpose({
	videoElement: videoElementRef
});
</script>

<style scoped>
.file-upload-area {
	margin-bottom: 16px;
}

.video-preview {
	background: var(--theme--background-subdued);
	border-radius: var(--theme--border-radius);
}

.video-preview:hover .actions,
.video-preview:hover .info {
	opacity: 1;
	visibility: visible;
}

.video-container {
	position: relative;
	width: 100%;
	max-width: 800px;
	margin: 0 auto;
}

.shadow {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: linear-gradient(to bottom, rgba(0, 0, 0, 0.3) 0%, transparent 30%, transparent 70%, rgba(0, 0, 0, 0.3) 100%);
	pointer-events: none;
	z-index: 1;
}

.actions {
	--v-button-color: var(--theme--form--field--input--foreground-subdued);
	--v-button-background-color: var(--white);
	--v-button-color-hover: var(--theme--form--field--input--foreground);
	--v-button-background-color-hover: var(--white);
	
	position: absolute;
	inset-block-start: calc(50% - 32px);
	inset-inline-start: 0;
	z-index: 3;
	display: flex;
	justify-content: center;
	inline-size: 100%;
	gap: 12px;
	
	opacity: 0;
	visibility: hidden;
	transition: opacity 0.2s ease, visibility 0.2s ease;
}

.actions :deep(.v-button) {
	--v-button-background-color: var(--white) !important;
	--v-button-color: var(--theme--form--field--input--foreground-subdued) !important;
	background-color: var(--white) !important;
	border-color: var(--white) !important;
}

.actions :deep(.v-button:hover) {
	--v-button-background-color-hover: var(--white) !important;
	--v-button-color-hover: var(--theme--form--field--input--foreground) !important;
	background-color: var(--white) !important;
	border-color: var(--white) !important;
}

.info {
	position: absolute;
	inset-block-start: 0;
	inset-inline-start: 0;
	z-index: 3;
	padding: 12px;
	line-height: 1.2;
	
	opacity: 0;
	visibility: hidden;
	transition: opacity 0.2s ease, visibility 0.2s ease;
}

.info .title {
	color: var(--theme--foreground-inverse, #fff);
	margin-bottom: 4px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.info .meta {
	color: var(--theme--foreground-inverse-subdued, rgba(255, 255, 255, 0.7));
	font-size: 12px;
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
}

.info .meta .hls-label,
.info .meta .dash-label {
	background: var(--theme--primary, #6644ff);
	color: var(--white, #fff);
	margin-top: 4px;
	padding: 2px 6px;
	border-radius: 4px;
	font-weight: 500;
	font-size: 11px;
}

.info .meta .quality-label {
	background: var(--theme--primary, #6644ff);
	color: var(--white, #fff);
	margin-top: 4px;
	padding: 2px 6px;
	border-radius: 4px;
	font-weight: 500;
	font-size: 11px;
}

.video-player {
	width: 100%;
	height: auto;
	display: block;
	aspect-ratio: 16/9;
	border-radius: var(--theme--border-radius);
	background: var(--theme--background-black, #000);
}

.video-player::-webkit-media-controls-loading-panel {
	display: none !important;
}

.video-player::-webkit-media-controls-play-button {
	display: flex !important;
}

.video-player::before {
	display: none !important;
	content: none !important;
}

.video-player::after {
	display: none !important;
	content: none !important;
}

.video-player[preload="none"] {
	background: var(--theme--background-black, #000);
}

.video-player:not([src])::before,
.video-player[preload="none"]::before {
	display: none !important;
	content: none !important;
}

.video-player::-moz-media-controls-loading-panel {
	display: none !important;
}
</style>

