<script>
  import { page } from '$app/stores';
  import Preloader from '$lib/components/Preloader.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import AdminOverrideDrawer from '$lib/components/AdminOverrideDrawer.svelte';

  const nav = [
    { href: '/', label: 'Home' },
    { href: '/status', label: 'Status' },
    { href: '/login', label: 'Admin' },
  ];
</script>

<Preloader>
  <div class="min-h-screen bg-ink text-text selection:bg-accent selection:text-white">
    <nav class="border-b border-border bg-ink/60 backdrop-blur-md sticky top-0 z-40">
      <div class="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <a
          href="/"
          class="flex items-center gap-2 font-bold text-xl tracking-tight text-text"
        >
          <div class="w-5 h-5 rounded bg-accent flex items-center justify-center text-[0.65rem] text-white font-black">E</div>
          <span>EasySupport</span>
        </a>
        <div class="flex items-center gap-8 ml-auto">
          {#each nav as item}
            <a
              href={item.href}
              class="text-sm font-medium transition-colors px-3 py-2 rounded-lg"
              class:text-accent={$page.path === item.href || ($page.path === '/' && item.href === '/')}
              class:text-muted={$page.path !== item.href && !($page.path === '/' && item.href === '/')}
            >
              {item.label}
            </a>
          {/each}
        </div>
      </div>
    </nav>

    <main class="relative">
      <slot />
    </main>

    <Footer />

    <AdminOverrideDrawer on:mutate />
  </div>
</Preloader>
