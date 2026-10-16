<script>
  import { fade } from 'svelte/transition';

  let user = $state('');
  let pass = $state('');
  let error = $state(null);
  let submitting = $state(false);

  async function handleSubmit(e) {
    e.preventDefault();
    error = null;
    submitting = true;
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, pass }),
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok) {
        window.location.replace('/');
      } else {
        error = json.error ?? 'Invalid credentials.';
      }
    } catch {
      error = 'Request failed.';
    } finally {
      submitting = false;
    }
  }
</script>

<section class="relative z-10 max-w-md mx-auto px-6 py-20">
  <div
    class="overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl"
    transition:fade={{ duration: 400 }}
  >
    <div class="p-8">
      <div class="flex items-center gap-2 mb-8">
        <div class="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-[0.7rem] text-white font-black">E</div>
        <h1 class="font-bold text-xl text-text tracking-tight">Admin login</h1>
      </div>

      {#if error}
        <div class="mb-6 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          {error}
        </div>
      {/if}

      <form onsubmit={handleSubmit} class="space-y-4">
        <div>
          <label for="username" class="block text-xs text-muted uppercase tracking-wider mb-1">Username</label>
          <input
            id="username"
            bind:value={user}
            type="text"
            required
            class="w-full bg-ink border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none transition-colors disabled:opacity-60"
            disabled={submitting}
          />
        </div>
        <div>
          <label for="password" class="block text-xs text-muted uppercase tracking-wider mb-1">Password</label>
          <input
            id="password"
            bind:value={pass}
            type="password"
            required
            class="w-full bg-ink border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none transition-colors disabled:opacity-60"
            disabled={submitting}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          class="w-full py-3 rounded-xl bg-accent text-white font-semibold disabled:opacity-50 hover:scale-[1.02] active:scale-95 transition-all duration-150 shadow-[0_0_20px_rgba(88,101,242,0.4)]"
        >
          {submitting ? 'Signing in&hellip;' : 'Sign in'}
        </button>
      </form>

      <p class="mt-8 text-[0.75rem] text-muted text-center">
        Only an admin can change the system status or post announcements. The status page itself is public.
      </p>
    </div>
  </div>
</section>
