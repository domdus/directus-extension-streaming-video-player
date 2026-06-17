import { computed } from 'vue';
import { useStores } from '@directus/extensions-sdk';

export function useOverlayActionButtonProps() {
	const { useServerStore } = useStores();
	const serverStore = useServerStore();

	const isDirectusV12 = computed(() => {
		// Read from the hydrated server store (no extra API call)
		const version = serverStore.info?.version;
		if (!version) return false;

		return Number.parseInt(version.split('.')[0] ?? '0', 10) >= 12;
	});

	const overlayActionButtonProps = computed(() =>
		isDirectusV12.value
			? { icon: true as const, small: true as const }
			: { icon: true as const, rounded: true as const, secondary: true as const },
	);

	return { isDirectusV12, overlayActionButtonProps };
}
