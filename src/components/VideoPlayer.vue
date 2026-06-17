<template>
	<div v-if="showPlayer" class="video-preview">
		<div class="video-container">
			<video
				ref="videoElement"
				:poster="posterUrl || undefined"
				controls
				:preload="preload"
				class="video-player"
				@loadedmetadata="$emit('loaded')"
			>
				Your browser does not support the video tag.
			</video>
			<div class="shadow"></div>
			<OverlayActions :is-v12="isDirectusV12">
				<v-button
					v-bind="overlayActionButtonProps"
					v-tooltip="isPlaying ? 'Pause' : 'Play'"
					@click="togglePlayPause"
				>
					<v-icon :name="isPlaying ? 'pause' : 'play_arrow'" />
				</v-button>
				<v-button
					v-bind="overlayActionButtonProps"
					v-tooltip="'Fullscreen'"
					@click="$emit('fullscreen')"
				>
					<v-icon name="zoom_in" />
				</v-button>
				<v-button
					v-if="showEdit"
					v-bind="overlayActionButtonProps"
					v-tooltip="'Edit'"
					@click="$emit('edit')"
				>
					<v-icon name="edit" />
				</v-button>
				<v-button
					v-if="showDownload"
					v-bind="overlayActionButtonProps"
					v-tooltip="'Download'"
					:href="downloadUrl"
					:download="downloadFilename"
				>
					<v-icon name="download" />
				</v-button>
				<v-button
					v-if="showClear"
					v-bind="overlayActionButtonProps"
					v-tooltip="'Clear'"
					@click="$emit('clear')"
				>
					<v-icon name="close" />
				</v-button>
			</OverlayActions>
			<div v-if="showInfo" class="info">
				<div class="title">{{ title }}</div>
				<div class="meta">
					<slot name="meta">
						<span v-if="showHlsLabel" class="hls-label">HLS</span>
						<span v-if="showHlsLabel && currentQuality" class="quality-label">{{ currentQuality }}</span>
					</slot>
				</div>
			</div>
		</div>
		<slot name="below-player"></slot>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useOverlayActionButtonProps } from '../composables/useOverlayActionButtonProps';
import OverlayActions from './OverlayActions.vue';

const { isDirectusV12, overlayActionButtonProps } = useOverlayActionButtonProps();

interface Props {
	showPlayer: boolean;
	posterUrl?: string | null;
	preload?: string;
	showEdit?: boolean;
	showDownload?: boolean;
	showClear?: boolean;
	showInfo?: boolean;
	title?: string;
	showHlsLabel?: boolean;
	currentQuality?: string | null;
	downloadUrl?: string;
	downloadFilename?: string;
}

defineProps<Props>();

defineEmits<{
	loaded: [];
	fullscreen: [];
	edit: [];
	clear: [];
}>();

const videoElement = ref<HTMLVideoElement | null>(null);
const isPlaying = ref(false);

const togglePlayPause = () => {
	if (!videoElement.value) return;
	
	if (videoElement.value.paused) {
		videoElement.value.play();
		isPlaying.value = true;
	} else {
		videoElement.value.pause();
		isPlaying.value = false;
	}
};

const updatePlayState = () => {
	if (videoElement.value) {
		isPlaying.value = !videoElement.value.paused;
	}
};

const setupEventListeners = () => {
	if (videoElement.value) {
		videoElement.value.addEventListener('play', updatePlayState);
		videoElement.value.addEventListener('pause', updatePlayState);
		videoElement.value.addEventListener('ended', () => {
			isPlaying.value = false;
		});
		// Initialize state
		updatePlayState();
	}
};

const removeEventListeners = () => {
	if (videoElement.value) {
		videoElement.value.removeEventListener('play', updatePlayState);
		videoElement.value.removeEventListener('pause', updatePlayState);
		videoElement.value.removeEventListener('ended', () => {
			isPlaying.value = false;
		});
	}
};

// Watch for video element to be available
watch(videoElement, (newVal) => {
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
	videoElement
});
</script>

<style scoped>
.video-preview {
	background: var(--theme--background-subdued);
	border-radius: var(--theme--border-radius);
}

.video-preview:hover .info,
.video-preview:focus-within .info {
	opacity: 1;
	visibility: visible;
}

.video-preview:hover .overlay-actions :deep(.v-button),
.video-preview:focus-within .overlay-actions :deep(.v-button) {
	transform: translateY(0);
	opacity: 1;
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

.info .meta .hls-label {
	background: var(--theme--primary, #6644ff);
	color: var(--theme--foreground-inverse, #fff);
	margin-top: 4px;
	padding: 2px 6px;
	border-radius: 4px;
	font-weight: 500;
	font-size: 11px;
}

.info .meta .quality-label {
	background: var(--theme--primary, #6644ff);
	color: var(--theme--foreground-inverse, #fff);
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

/* Hide native HTML5 video loading spinner */
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

