<template>
	<div class="overlay-actions" :class="{ 'overlay-actions--v12': isV12 }">
		<slot />
	</div>
</template>

<script setup lang="ts">
defineProps<{
	isV12: boolean;
}>();
</script>

<style scoped>
.overlay-actions {
	--v-button-color: var(--theme--form--field--input--foreground-subdued);
	--v-button-background-color: var(--white);
	--v-button-color-hover: var(--theme--form--field--input--foreground);
	--v-button-background-color-hover: var(--white);

	position: absolute;
	inset-inline-start: 0;
	z-index: 3;
	display: flex;
	justify-content: center;
	inline-size: 100%;
}

/* v11 */
.overlay-actions:not(.overlay-actions--v12) {
	inset-block-start: calc(50% - 32px);
	gap: 12px;
}

.overlay-actions:not(.overlay-actions--v12) :deep(.button) {
	--v-button-background-color: var(--white) !important;
	--v-button-color: var(--theme--form--field--input--foreground-subdued) !important;
	background-color: var(--white) !important;
	border-color: var(--white) !important;
}

.overlay-actions:not(.overlay-actions--v12) :deep(.button:hover) {
	--v-button-background-color-hover: var(--white) !important;
	--v-button-color-hover: var(--theme--form--field--input--foreground) !important;
	background-color: var(--white) !important;
	border-color: var(--white) !important;
}

/* v12 */
.overlay-actions--v12 {
	inset-block-start: 50%;
	transform: translate(0, -50%);
	gap: 0.625rem;
}

/* Staggered reveal (native file-image on v11 and v12) */
.overlay-actions :deep(.v-button) {
	transform: translateY(0.5625rem);
	opacity: 0;
	transition: var(--medium) var(--transition);
	transition-property: opacity, transform;
}

.overlay-actions :deep(.v-button:nth-of-type(1)) {
	transition-delay: 0ms;
}

.overlay-actions :deep(.v-button:nth-of-type(2)) {
	transition-delay: 25ms;
}

.overlay-actions :deep(.v-button:nth-of-type(3)) {
	transition-delay: 50ms;
}

.overlay-actions :deep(.v-button:nth-of-type(4)) {
	transition-delay: 75ms;
}

.overlay-actions :deep(.v-button:nth-of-type(5)) {
	transition-delay: 100ms;
}

.overlay-actions :deep(.v-button:nth-of-type(6)) {
	transition-delay: 125ms;
}
</style>
