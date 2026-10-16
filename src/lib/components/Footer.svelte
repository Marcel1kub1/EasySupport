<script>
  import { onMount } from 'svelte';
</script>

<footer class="border-t border-border bg-ink/50 backdrop-blur mt-20 py-12">
  <div class="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-muted">
    <div class="flex items-center gap-2">
      <div class="w-5 h-5 rounded bg-accent flex items-center justify-center text-[0.65rem] text-white font-black">E</div>
      <span class="font-semibold text-text tracking-tight">EasySupport</span>
    </div>
    <nav class="flex gap-6">
      <a href="/" class="hover:text-text transition-colors">Home</a>
      <a href="/status" class="hover:text-text transition-colors">Status</a>
      <a href="/login" class="hover:text-text transition-colors">Admin</a>
    </nav>
    <p class="text-[0.7rem]">
      Self-hosted Discord ticketing bot &middot;
      <a href="https://github.com/Marcel1kub1/EasySupport" target="_blank" rel="noopener" class="text-accent hover:underline">GitHub</a>
    </p>
  </div>
</footer>
