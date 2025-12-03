<template>
	<div :class="['input-wrapper', `font-${inputOptions.font}`]">
		<v-input
			v-if="showInput"
			:model-value="displayValue"
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
			v-if="inputOptions.softLength && displayValue" 
			class="soft-length-indicator" 
			:class="{ 'soft-length-exceeded': displayValue.length > inputOptions.softLength }"
		>
			{{ displayValue.length }} / {{ inputOptions.softLength }}
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { InputOptions } from '../composables/useInputOptions';

interface Props {
	value: string | null;
	editingValue: string | null;
	isEditing: boolean;
	isFileModule: boolean;
	disabled?: boolean;
	inputOptions: InputOptions;
	inputPlaceholder: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
	'update:value': [value: string | null];
	blur: [];
}>();

const showInput = computed(() => {
	return !props.value || props.isEditing || props.isFileModule;
});

const displayValue = computed(() => {
	return props.isEditing ? props.editingValue : props.value;
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
</style>

