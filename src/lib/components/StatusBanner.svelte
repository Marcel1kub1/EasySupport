<script>
  import { crossfade } from 'svelte/transition';
  import { globalStatus } from '$lib/stores.js';
  import { statusConfig, GLOBAL_LABELS } from '$lib/utils.js';

  const [send, receive] = crossfade({ duration: 400 });

  let { status } = $props();
  let cfg = $derived(statusConfig(status));
  let label = $derived(GLOBAL_LABELS[status] ?? GLOBAL_LABELS.operational);
</script>

<div
  class="relative z-10 overflow-hidden rounded-2xl border border-border bg-panel transition-all duration-500 ease-out"
  class:shadow-[0_0_40px_rgba(16,185,129,0.25)]={status === 'operational'}
  class:shadow-[0_0_40px_rgba(245,158,11,0.25)]={status === 'degraded'}
  class:shadow-[0_0_40px_rgba(239,68,68,0.25)]={status === 'outage'}
  class:shadow-[0_0_40px_rgba(100,116,139,0.25)]={status === 'maintenance'}
>
  <div class="absolute inset-0 bg-[${cfg.dot}]/5 opacity-0 transition-opacity duration-700"></div>
  <div class="relative px-6 py-5 flex items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <div
        class="w-2.5 h-2.5 rounded-full ${cfg.dot} animate-pulse shadow-[0_0_10px_currentColor]"
      ></div>
      <div>
        <div class="font-bold text-text">{label}</div>
        <div class="text-xs text-muted">System health across all nodes</div>
      </div>
    </div>
    <div
      class="px-3 py-1.5 rounded-full ${cfg.bg} ${cfg.border} ${cfg.text} text-[0.7rem] font-semibold uppercase tracking-wider transition-colors duration-500"
    >
      {label}
    </div>
  </div>
</div>
