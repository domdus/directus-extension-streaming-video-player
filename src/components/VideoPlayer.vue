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
			<div class="actions">
				<v-button
					v-tooltip="'Zoom in'"
					rounded
					icon
					secondary
					@click="$emit('fullscreen')"
				>
					<v-icon name="zoom_in" />
				</v-button>
				<v-button
					v-if="showEdit"
					v-tooltip="'Edit'"
					rounded
					icon
					secondary
					@click="$emit('edit')"
				>
					<v-icon name="edit" />
				</v-button>
				<v-button
					v-if="showDownload"
					v-tooltip="'Download'"
					rounded
					icon
					secondary
					:href="downloadUrl"
					:download="downloadFilename"
				>
					<v-icon name="download" />
				</v-button>
				<v-button
					v-if="showClear"
					v-tooltip="'Clear'"
					rounded
					icon
					secondary
					@click="$emit('clear')"
				>
					<v-icon name="close" />
				</v-button>
			</div>
			<div v-if="showInfo" class="info">
				<div class="title">{{ title }}</div>
				<div class="meta">
					<slot name="meta">
						<span v-if="showHlsLabel" class="hls-label">HLS</span>
					</slot>
				</div>
			</div>
		</div>
		<slot name="below-player"></slot>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

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

const videoElement = defineExpose({
	videoElement: ref<HTMLVideoElement | null>(null)
});
</script>

<style scoped>
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

.info .meta .hls-label {
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

