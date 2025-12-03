/**
 * Composable for managing file data
 */
import { ref, type Ref } from 'vue';
import { useApi } from '@directus/extensions-sdk';

export interface FileData {
	id?: string;
	type?: string;
	filename_download?: string;
	stream_hls?: string;
	title?: string;
	[key: string]: any;
}

export function useFileData() {
	const api = useApi();
	const fileData = ref<FileData | null>(null);
	const loading = ref(false);

	const loadFileData = async (fileId: string): Promise<FileData | null> => {
		loading.value = true;
		try {
			const response = await api.get(`/files/${fileId}`);
			fileData.value = response.data.data;
			return fileData.value;
		} catch (error) {
			console.error('Failed to load file data:', error);
			fileData.value = null;
			return null;
		} finally {
			loading.value = false;
		}
	};

	const clearFileData = () => {
		fileData.value = null;
	};

	return {
		fileData: fileData as Ref<FileData | null>,
		loading: loading as Ref<boolean>,
		loadFileData,
		clearFileData
	};
}

