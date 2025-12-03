<template>
	<div>
		<!-- Input field - show when value is null, when editing, or when in file module -->
		<div :class="['input-wrapper', `font-${inputOptions.font}`]">
			<v-input
				v-if="!value || isEditingStringField || isFileModule"
				:model-value="isEditingStringField ? editingValue : processedValue"
				:disabled="disabled"
				:placeholder="inputPlaceholder"
				:icon-left="inputOptions.iconLeft"
				:icon-right="inputOptions.iconRight"
				:autocomplete="inputOptions.masked ? 'off' : undefined"
				:type="inputOptions.masked ? 'password' : 'text'"
				@update:model-value="$emit('update:value', $event)"
				@blur="$emit('blur')"
			/>
			<!-- Soft length indicator -->
			<div 
				v-if="inputOptions.softLength && (isEditingStringField ? editingValue : processedValue)" 
				class="soft-length-indicator" 
				:class="{ 'soft-length-exceeded': (isEditingStringField ? editingValue : processedValue)?.length && (isEditingStringField ? editingValue : processedValue)!.length > inputOptions.softLength }"
			>
				{{ (isEditingStringField ? editingValue : processedValue)?.length || 0 }} / {{ inputOptions.softLength }}
			</div>
		</div>
		
		<!-- Video Player Preview for string fields (only show if not replacing default player and has value) -->
		<div v-if="!shouldReplaceDefaultPlayer && value && streamUrlFromValue" class="video-preview">
			<div class="video-container">
				<video
					ref="videoElementRef"
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
						v-tooltip="'Zoom in'"
						rounded
						icon
						secondary
						@click="$emit('fullscreen')"
					>
						<v-icon name="zoom_in" />
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
				<div v-if="value" class="info">
					<div class="title">{{ value.split('/').pop() }}</div>
					<div class="meta">
						<span v-if="useHls" class="hls-label">
							HLS
						</span>
					</div>
				</div>
			</div>
			<!-- Toggle button below player - only show for file item pages -->
			<div v-if="isFileModule" class="format-toggle-container">
				<button
					class="format-toggle"
					@click="$emit('toggle-format')"
				>
					{{ useHls ? 'Switch to MP4' : 'Switch to HLS' }}
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { InputOptions } from '../composables/useInputOptions';

interface Props {
	value: string | null;
	editingValue: string | null;
	isEditingStringField: boolean;
	isFileModule: boolean;
	shouldReplaceDefaultPlayer: boolean;
	streamUrlFromValue: string | null;
	videoPreload: string;
	useHls: boolean;
	disabled?: boolean;
	inputOptions: InputOptions;
	inputPlaceholder: string;
	processedValue: string | null;
}

defineProps<Props>();

defineEmits<{
	'update:value': [value: string | null];
	blur: [];
	loaded: [];
	fullscreen: [];
	edit: [];
	clear: [];
	'toggle-format': [];
}>();

const videoElementRef = ref<HTMLVideoElement | null>(null);

// Watch for when video element becomes available and expose it
watch(videoElementRef, () => {
	// Video element ref is available
}, { immediate: true });

defineExpose({
	videoElement: videoElementRef
});
</script>

<style scoped>
.input-wrapper {
	position: relative;
}

.input-wrapper.font-sans-serif :deep(input),
.input-wrapper.font-sans-serif :deep(textarea) {
	font-family: var(--theme--font-family-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif);
}

.input-wrapper.font-serif :deep(input),
.input-wrapper.font-serif :deep(textarea) {
	font-family: var(--theme--font-family-serif, Georgia, 'Times New Roman', serif);
}

.input-wrapper.font-monospace :deep(input),
.input-wrapper.font-monospace :deep(textarea) {
	font-family: var(--theme--font-family-monospace, 'Courier New', Courier, monospace);
}

.soft-length-indicator {
	position: absolute;
	bottom: -20px;
	right: 0;
	font-size: 12px;
	color: var(--theme--foreground-subdued, #999);
	padding: 2px 4px;
}

.soft-length-indicator.soft-length-exceeded {
	color: var(--theme--danger, #ff0000);
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

.format-toggle-container {
	display: flex;
	justify-content: flex-end;
	margin-block-start: 12px;
	position: absolute;
	right: 0;
}

.format-toggle {
	color: var(--theme--primary);
	cursor: pointer;
	font-weight: 600;
	background: none;
	border: none;
	padding: 0;
	font-family: inherit;
	font-size: inherit;
}

.format-toggle:hover {
	opacity: 0.8;
}
</style>

