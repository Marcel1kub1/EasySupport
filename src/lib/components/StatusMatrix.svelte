<script>
  import { componentNodes } from '$lib/stores.js';
  import { generateUptimeBlocks } from '$lib/utils.js';
  import StatusBanner from './StatusBanner.svelte';
  import ComponentRow from './ComponentRow.svelte';

  let { nodes, global } = $props();

  let nodesWithBlocks = $derived(
    nodes.map((n) => ({
      ...n,
      uptimeBlocks: generateUptimeBlocks(n.status),
    }))
  );
</script>

<section class="relative z-10">
  <StatusBanner {global} />

  <div class="mt-8">
    <div class="flex items-center justify-between mb-6">
      <h2 class="font-semibold text-text uppercase tracking-wider text-[0.7rem]">Components</h2>
    </div>
    <div class="grid md:grid-cols-3 gap-4">
      {#each nodesWithBlocks as node, index (node.id)}
        <ComponentRow {node} />
      {/each}
    </div>
  </div>
</section>
