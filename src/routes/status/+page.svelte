<script>
  import { onMount } from 'svelte';
  import { componentNodes } from '$lib/stores.js';
  import StatusMatrix from '$lib/components/StatusMatrix.svelte';

  let { data } = $props();

  onMount(() => {
    // Seed client-side override state from server-fetched nodes
    componentNodes.set(
      data.components.map((c) => ({
        id: c.id,
        name: c.name,
        desc: c.desc,
        status: c.status,
      }))
    );
  });
</script>

<StatusMatrix nodes={data.components} global={data.globalStatus} />
