<template>
	<drawer-item
		v-if="fileData"
		v-model:active="editDrawerActive"
		collection="directus_files"
		:primary-key="fileData.id"
		:edits="edits"
		:disabled="disabled"
		@input="$emit('update', $event)"
	>
		<template #actions>
			<v-button
				secondary
				rounded
				icon
				:download="fileData?.filename_download"
				:href="downloadUrl"
			>
				<v-icon name="download" />
			</v-button>
		</template>
	</drawer-item>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { FileData } from '../composables/useFileData';

interface Props {
	fileData: FileData | null;
	downloadUrl: string | null;
	disabled?: boolean;
	value: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
	update: [value: string | Record<string, any> | null];
}>();

const editDrawerActive = ref(false);

const edits = computed(() => {
	if (!props.value || typeof props.value !== 'object') return {};
	return props.value;
});

defineExpose({
	editDrawerActive
});
</script>

