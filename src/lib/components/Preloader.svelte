<script>
  import { fade, fly } from 'svelte/transition';
  import { preloaderVisible } from '$lib/stores.js';

  let done = false;

  async function finish() {
    await new Promise((r) => setTimeout(r, 1400));
    done = true;
  }

  finish();
</script>

{#if $preloaderVisible && !done}
  <div
    class="fixed inset-0 z-50 bg-ink flex items-center justify-center"
    transition:fade={{ duration: 600 }}
  >
    <div class="relative w-24 h-24 flex flex-col items-center justify-center gap-3">
      <div
        class="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center text-[1.5rem] animate-pulse shadow-[0_0_30px_rgba(88,101,242,0.5)]"
      >
        E
      </div>
      <div class="w-full h-[2px] bg-border relative overflow-hidden">
        <div
          class="absolute left-0 top-0 h-full bg-accent w-[35%] animate-[marquee_2s_linear_infinite]"
        ></div>
      </div>
      <p class="text-xs text-muted tracking-widest uppercase">initializing system</p>
    </div>
  </div>
{:else}
  <slot />
{/if}
