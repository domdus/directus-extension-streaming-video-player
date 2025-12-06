<template>
	<drawer-item
		v-if="fileData"
		v-model:active="editDrawerActive"
		collection="directus_files"
		:primary-key="fileData.id"
		:edits="edits"
		:disabled="disabled"
		@input="handleDrawerInput"
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
import { useApi } from '@directus/extensions-sdk';
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

const api = useApi();
const editDrawerActive = ref(false);

const edits = computed(() => {
	if (!props.value || typeof props.value !== 'object') return {};
	return props.value;
});

// Handle drawer input event - this is emitted when user clicks save in drawer
// The drawer-item component emits this event, but we need to actually save to API
// This matches the pattern from the image interface which uses useRelationSingle's update function
const handleDrawerInput = async (value: string | Record<string, any> | null) => {
	if (!props.fileData?.id) return;
	
	// If value is an object with the file data, save it to the API
	if (value && typeof value === 'object' && value.id === props.fileData.id) {
		try {
			// Extract the fields to update (exclude id and other system fields)
			const updateData: Record<string, any> = {};
			const fieldsToUpdate = ['title', 'description', 'tags', 'folder', 'filename_download'];
			
			for (const field of fieldsToUpdate) {
				if (field in value) {
					updateData[field] = value[field];
				}
			}
			
			// Also include any other custom fields that might have been edited
			Object.keys(value).forEach(key => {
				if (!['id', 'modified_on', 'created_on', 'modified_by', 'created_by'].includes(key)) {
					if (!(key in updateData)) {
						updateData[key] = value[key];
					}
				}
			});
			
			// Save the changes to the API
			await api.patch(`/files/${props.fileData.id}`, updateData);
			
			// Emit the update event to parent with the updated data
			emit('update', value);
		} catch (error) {
			console.error('Failed to save file changes:', error);
			// Still emit the update event even if save failed, so UI can update
			emit('update', value);
		}
	} else if (typeof value === 'string') {
		// If value is just an ID string, emit it as is
		emit('update', value);
	} else {
		// If value is null, emit it
		emit('update', value);
	}
};

defineExpose({
	editDrawerActive
});
</script>

