import { k as store_get, l as slot, m as unsubscribe_stores, n as ensure_array_like, o as attr_class, p as getContext } from './index-CkMI0j-Y.js';
import './root-B_f1OIs6.js';
import './state.svelte-CxH4NiCo.js';
import { p as preloaderVisible, a as adminUnlocked } from './stores-YsuwijFb.js';
import { a as attr, e as escape_html } from './attributes-CMMjMIGF.js';
import './index2-BYq7dByy.js';

const getStores = () => {
  const stores = getContext("__svelte__");
  return {
    /** @type {typeof page} */
    page: {
      subscribe: stores.page.subscribe
    },
    /** @type {typeof navigating} */
    navigating: {
      subscribe: stores.navigating.subscribe
    },
    /** @type {typeof updated} */
    updated: stores.updated
  };
};
const page = {
  subscribe(fn) {
    const store = getStores().page;
    return store.subscribe(fn);
  }
};
function Preloader($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let done = false;
    async function finish() {
      await new Promise((r) => setTimeout(r, 1400));
      done = true;
    }
    finish();
    if (store_get($$store_subs ??= {}, "$preloaderVisible", preloaderVisible) && !done) {
      $$renderer2.push(`<!--[0--><div class="fixed inset-0 z-50 bg-ink flex items-center justify-center"><div class="relative w-24 h-24 flex flex-col items-center justify-center gap-3"><div class="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center text-[1.5rem] animate-pulse shadow-[0_0_30px_rgba(88,101,242,0.5)]">E</div> <div class="w-full h-[2px] bg-border relative overflow-hidden"><div class="absolute left-0 top-0 h-full bg-accent w-[35%] animate-[marquee_2s_linear_infinite]"></div></div> <p class="text-xs text-muted tracking-widest uppercase">initializing system</p></div></div>`);
    } else {
      $$renderer2.push(`<!--[-1--><!--[-->`);
      slot($$renderer2, $$props, "default", {});
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function Footer($$renderer) {
  $$renderer.push(`<footer class="border-t border-border bg-ink/50 backdrop-blur mt-20 py-12"><div class="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-muted"><div class="flex items-center gap-2"><div class="w-5 h-5 rounded bg-accent flex items-center justify-center text-[0.65rem] text-white font-black">E</div> <span class="font-semibold text-text tracking-tight">EasySupport</span></div> <nav class="flex gap-6"><a href="/" class="hover:text-text transition-colors">Home</a> <a href="/status" class="hover:text-text transition-colors">Status</a> <a href="/login" class="hover:text-text transition-colors">Admin</a></nav> <p class="text-[0.7rem]">Self-hosted Discord ticketing bot · <a href="https://github.com/Marcel1kub1/EasySupport" target="_blank" rel="noopener" class="text-accent hover:underline">GitHub</a></p></div></footer>`);
}
function AdminOverrideDrawer($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let password = "";
    let selectedNode = "";
    let newStatus = "operational";
    const STATUSES = [
      { value: "operational", label: "Operational" },
      { value: "degraded", label: "Degraded" },
      { value: "outage", label: "Major Outage" },
      { value: "maintenance", label: "Maintenance" }
    ];
    if (!store_get($$store_subs ??= {}, "$adminUnlocked", adminUnlocked)) {
      $$renderer2.push(`<!--[0--><div class="relative z-10 overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl"><div class="p-6"><div class="flex items-center justify-between mb-4"><h2 class="font-bold text-text">Staff Override</h2> <button class="text-muted hover:text-text transition-colors" aria-label="Close"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div> <p class="text-sm text-muted mb-6">Enter the staff override password to mutate system node states.</p> <form class="space-y-3"><div><label for="override-password" class="block text-xs text-muted uppercase tracking-wider mb-1">Override password</label> <input id="override-password"${attr("value", password)} type="password" class="w-full bg-ink border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none transition-colors" placeholder="••••••"/></div> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <button type="submit" class="w-full py-3 rounded-xl bg-accent text-white font-semibold hover:scale-[1.02] active:scale-95 transition-transform shadow-[0_0_20px_rgba(88,101,242,0.4)]">Unlock panel</button></form></div></div>`);
    } else {
      $$renderer2.push(`<!--[-1--><div class="relative z-10 overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl"><div class="p-6"><div class="flex items-center justify-between mb-6"><div><h2 class="font-bold text-text">Staff Override</h2> <p class="text-sm text-muted">Select a node and set its system state.</p></div> <button class="text-muted hover:text-text transition-colors">Lock panel</button></div> <form class="space-y-4"><div><label for="override-node" class="block text-xs text-muted uppercase tracking-wider mb-1">System node</label> `);
      $$renderer2.select(
        {
          id: "override-node",
          value: selectedNode,
          class: "w-full bg-ink border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none transition-colors appearance-none"
        },
        ($$renderer3) => {
          $$renderer3.option({ value: "" }, ($$renderer4) => {
            $$renderer4.push(`Select node…`);
          });
          $$renderer3.option({ value: "gateway" }, ($$renderer4) => {
            $$renderer4.push(`Gateway Shard 0`);
          });
          $$renderer3.option({ value: "lavalink" }, ($$renderer4) => {
            $$renderer4.push(`Lavalink Audio Node`);
          });
          $$renderer3.option({ value: "rest" }, ($$renderer4) => {
            $$renderer4.push(`REST API Endpoint`);
          });
        }
      );
      $$renderer2.push(`</div> <div><label for="override-status" class="block text-xs text-muted uppercase tracking-wider mb-1">New state</label> `);
      $$renderer2.select(
        {
          id: "override-status",
          value: newStatus,
          class: "w-full bg-ink border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none transition-colors appearance-none"
        },
        ($$renderer3) => {
          $$renderer3.push(`<!--[-->`);
          const each_array = ensure_array_like(STATUSES);
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let s = each_array[$$index];
            $$renderer3.option({ value: s.value }, ($$renderer4) => {
              $$renderer4.push(`${escape_html(s.label)}`);
            });
          }
          $$renderer3.push(`<!--]-->`);
        }
      );
      $$renderer2.push(`</div> <button type="submit" class="w-full py-3 rounded-xl bg-accent text-white font-semibold hover:scale-[1.02] active:scale-95 transition-transform shadow-[0_0_20px_rgba(88,101,242,0.4)]">Apply override</button></form></div></div>`);
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    const nav = [
      { href: "/", label: "Home" },
      { href: "/status", label: "Status" },
      { href: "/login", label: "Admin" }
    ];
    Preloader($$renderer2, {
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="min-h-screen bg-ink text-text selection:bg-accent selection:text-white"><nav class="border-b border-border bg-ink/60 backdrop-blur-md sticky top-0 z-40"><div class="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between"><a href="/" class="flex items-center gap-2 font-bold text-xl tracking-tight text-text"><div class="w-5 h-5 rounded bg-accent flex items-center justify-center text-[0.65rem] text-white font-black">E</div> <span>EasySupport</span></a> <div class="flex items-center gap-8 ml-auto"><!--[-->`);
        const each_array = ensure_array_like(nav);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let item = each_array[$$index];
          $$renderer3.push(`<a${attr("href", item.href)}${attr_class("text-sm font-medium transition-colors px-3 py-2 rounded-lg", void 0, {
            "text-accent": store_get($$store_subs ??= {}, "$page", page).path === item.href || store_get($$store_subs ??= {}, "$page", page).path === "/" && item.href === "/",
            "text-muted": store_get($$store_subs ??= {}, "$page", page).path !== item.href && !(store_get($$store_subs ??= {}, "$page", page).path === "/" && item.href === "/")
          })}>${escape_html(item.label)}</a>`);
        }
        $$renderer3.push(`<!--]--></div></div></nav> <main class="relative"><!--[-->`);
        slot($$renderer3, $$props, "default", {});
        $$renderer3.push(`<!--]--></main> `);
        Footer($$renderer3);
        $$renderer3.push(`<!----> `);
        AdminOverrideDrawer($$renderer3);
        $$renderer3.push(`<!----></div>`);
      },
      $$slots: { default: true }
    });
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}

export { _layout as default };
//# sourceMappingURL=_layout.svelte-C3mJn1cs.js.map
