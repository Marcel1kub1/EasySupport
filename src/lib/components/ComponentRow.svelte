<script>
  import { crossfade } from 'svelte/transition';
  import { statusConfig } from '$lib/utils.js';

  const [send, receive] = crossfade({ duration: 400 });

  let { node } = $props();
  let cfg = $derived(statusConfig(node.status));
  let borderClass = $derived(
    node.status === 'operational'
      ? 'border-emerald-500/50'
      : node.status === 'degraded'
      ? 'border-amber-500/50'
      : node.status === 'outage'
      ? 'border-rose-500/50'
      : 'border-slate-500/50'
  );
  let divClass = $derived(
    `group relative z-10 overflow-hidden rounded-xl border border-border bg-panel transition-all duration-500 ease-out hover:border-border/60 ${borderClass}`
  );
</script>

<div class={divClass}>
  <div
    class="absolute inset-0 ${cfg.dot}/4 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
  ></div>
  <div class="relative p-5 flex items-start justify-between gap-4">
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <h3 class="font-semibold text-text">{node.name}</h3>
        <span
          class="w-2 h-2 rounded-full ${cfg.dot} animate-pulse shadow-[0_0_8px_currentColor]"
        ></span>
      </div>
      <p class="text-sm text-muted mt-1">{node.desc}</p>
    </div>
    <div class="flex items-end gap-2">
      <span
        class="px-2.5 py-1 rounded-lg ${cfg.bg} ${cfg.border} ${cfg.text} text-[0.65rem] font-semibold uppercase tracking-wider whitespace-nowrap"
      >
        {cfg.label}
      </span>
    </div>
  </div>

  <!-- 90-day uptime sparkline -->
  <div class="px-5 pb-4 border-t border-border/50">
    <div class="flex items-end gap-0.5 h-6">
      {#each node.uptimeBlocks as block, i}
        <svg
          width="4"
          height="6"
          class="${statusConfig(block).dot}"
          style="height: calc(6px + {i % 4}px)"
        >
          <rect width="4" height="6" rx="1" />
        </svg>
      {/each}
    </div>
    <div class="flex justify-between mt-2 text-[0.65rem] text-muted">
      <span>90-day uptime</span>
      <span>99.9%</span>
    </div>
  </div>
</div>
