import { a as attr, e as escape_html } from './attributes-CMMjMIGF.js';

function _page($$renderer) {
  let user = "";
  let pass = "";
  let submitting = false;
  $$renderer.push(`<section class="relative z-10 max-w-md mx-auto px-6 py-20"><div class="overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl"><div class="p-8"><div class="flex items-center gap-2 mb-8"><div class="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-[0.7rem] text-white font-black">E</div> <h1 class="font-bold text-xl text-text tracking-tight">Admin login</h1></div> `);
  {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--> <form class="space-y-4"><div><label for="username" class="block text-xs text-muted uppercase tracking-wider mb-1">Username</label> <input id="username"${attr("value", user)} type="text" required="" class="w-full bg-ink border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none transition-colors disabled:opacity-60"${attr("disabled", submitting, true)}/></div> <div><label for="password" class="block text-xs text-muted uppercase tracking-wider mb-1">Password</label> <input id="password"${attr("value", pass)} type="password" required="" class="w-full bg-ink border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none transition-colors disabled:opacity-60"${attr("disabled", submitting, true)}/></div> <button type="submit"${attr("disabled", submitting, true)} class="w-full py-3 rounded-xl bg-accent text-white font-semibold disabled:opacity-50 hover:scale-[1.02] active:scale-95 transition-all duration-150 shadow-[0_0_20px_rgba(88,101,242,0.4)]">${escape_html("Sign in")}</button></form> <p class="mt-8 text-[0.75rem] text-muted text-center">Only an admin can change the system status or post announcements. The status page itself is public.</p></div></div></section>`);
}

export { _page as default };
//# sourceMappingURL=_page.svelte-CqqnkCF1.js.map
