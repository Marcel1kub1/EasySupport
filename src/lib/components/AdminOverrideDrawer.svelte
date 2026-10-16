<script>
  import { fly } from 'svelte/transition';
  import { adminUnlocked } from '$lib/stores.js';

  let password = $state('');
  let unlockError = $state(false);
  let selectedNode = $state('');
  let newStatus = $state('operational');

  const STATUSES = [
    { value: 'operational', label: 'Operational' },
    { value: 'degraded', label: 'Degraded' },
    { value: 'outage', label: 'Major Outage' },
    { value: 'maintenance', label: 'Maintenance' },
  ];

  function handleUnlock(e) {
    e.preventDefault();
    const expected = import.meta.env?.VITE_ADMIN_OVERRIDE_PASSWORD ?? 'override123';
    if (password === expected) {
      adminUnlocked.set(true);
      unlockError = false;
      password = '';
    } else {
      unlockError = true;
      setTimeout(() => (unlockError = false), 2500);
    }
  }

  function handleLock() {
    adminUnlocked.set(false);
    selectedNode = '';
    newStatus = 'operational';
  }

  function handleMutate(e) {
    e.preventDefault();
    if (!selectedNode || !newStatus) return;
    // Client-side mutation only; in production this calls a secured API.
    dispatch('mutate', { nodeId: selectedNode, status: newStatus });
    handleLock();
  }
</script>

{#if !$adminUnlocked}
  <div
    class="relative z-10 overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl"
    transition:fly={{ y: 40, duration: 400 }}
  >
    <div class="p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-bold text-text">Staff Override</h2>
        <button
          onclick={handleLock}
          class="text-muted hover:text-text transition-colors"
          aria-label="Close"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
      <p class="text-sm text-muted mb-6">Enter the staff override password to mutate system node states.</p>
      <form onsubmit={handleUnlock} class="space-y-3">
        <div>
          <label for="override-password" class="block text-xs text-muted uppercase tracking-wider mb-1">Override password</label>
          <input
            id="override-password"
            bind:value={password}
            type="password"
            class="w-full bg-ink border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none transition-colors"
            placeholder="&bull;&bull;&bull;&bull;&bull;&bull;"
          />
        </div>
        {#if unlockError}
          <p class="text-xs text-rose-400">Invalid override password.</p>
        {/if}
        <button
          type="submit"
          class="w-full py-3 rounded-xl bg-accent text-white font-semibold hover:scale-[1.02] active:scale-95 transition-transform shadow-[0_0_20px_rgba(88,101,242,0.4)]"
        >
          Unlock panel
        </button>
      </form>
    </div>
  </div>
{:else}
  <div
    class="relative z-10 overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl"
    transition:fly={{ y: 40, duration: 400 }}
  >
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="font-bold text-text">Staff Override</h2>
          <p class="text-sm text-muted">Select a node and set its system state.</p>
        </div>
        <button onclick={handleLock} class="text-muted hover:text-text transition-colors">Lock panel</button>
      </div>

      <form onsubmit={handleMutate} class="space-y-4">
        <div>
          <label for="override-node" class="block text-xs text-muted uppercase tracking-wider mb-1">System node</label>
          <select
            id="override-node"
            bind:value={selectedNode}
            class="w-full bg-ink border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none transition-colors appearance-none"
          >
            <option value="">Select node&hellip;</option>
            <option value="gateway">Gateway Shard 0</option>
            <option value="lavalink">Lavalink Audio Node</option>
            <option value="rest">REST API Endpoint</option>
          </select>
        </div>
        <div>
          <label for="override-status" class="block text-xs text-muted uppercase tracking-wider mb-1">New state</label>
          <select
            id="override-status"
            bind:value={newStatus}
            class="w-full bg-ink border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none transition-colors appearance-none"
          >
            {#each STATUSES as s}
              <option value={s.value}>{s.label}</option>
            {/each}
          </select>
        </div>
        <button
          type="submit"
          class="w-full py-3 rounded-xl bg-accent text-white font-semibold hover:scale-[1.02] active:scale-95 transition-transform shadow-[0_0_20px_rgba(88,101,242,0.4)]"
        >
          Apply override
        </button>
      </form>
    </div>
  </div>
{/if}
