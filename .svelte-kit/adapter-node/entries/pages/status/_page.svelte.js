import "clsx";
import "../../../chunks/stores.js";
import { b as attr_class, a8 as stringify, a7 as derived, e as ensure_array_like, a9 as attr_style } from "../../../chunks/index.js";
import { e as escape_html, c as clsx } from "../../../chunks/attributes.js";
const STATUS_CONFIG = {
  operational: {
    label: "Operational",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    shadow: "shadow-[0_0_20px_rgba(16,185,129,0.35)]",
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/20"
  },
  degraded: {
    label: "Degraded Performance",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/30",
    shadow: "shadow-[0_0_20px_rgba(245,158,11,0.35)]",
    dot: "bg-amber-500",
    ring: "ring-amber-500/20"
  },
  outage: {
    label: "Major Outage",
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/30",
    shadow: "shadow-[0_0_20px_rgba(239,68,68,0.35)]",
    dot: "bg-rose-500",
    ring: "ring-rose-500/20"
  },
  maintenance: {
    label: "Maintenance",
    bg: "bg-slate-500/10",
    text: "text-slate-400",
    border: "border-slate-500/30",
    shadow: "shadow-[0_0_20px_rgba(100,116,139,0.35)]",
    dot: "bg-slate-500",
    ring: "ring-slate-500/20"
  }
};
function statusConfig(status) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.operational;
}
function generateUptimeBlocks(status, count = 90) {
  const blocks = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    let blockStatus = status;
    if (r > 0.94) blockStatus = "degraded";
    else if (r > 0.985) blockStatus = "outage";
    blocks.push(blockStatus);
  }
  return blocks;
}
const GLOBAL_LABELS = {
  operational: "All Systems Operational",
  degraded: "Degraded Performance",
  outage: "Major Outage",
  maintenance: "Maintenance"
};
function StatusBanner($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { status } = $$props;
    let cfg = derived(() => statusConfig(status));
    let label = derived(() => GLOBAL_LABELS[status] ?? GLOBAL_LABELS.operational);
    $$renderer2.push(`<div${attr_class("relative z-10 overflow-hidden rounded-2xl border border-border bg-panel transition-all duration-500 ease-out", void 0, {
      "shadow-[0_0_40px_rgba(16,185,129,0.25)]": status === "operational",
      "shadow-[0_0_40px_rgba(245,158,11,0.25)]": status === "degraded",
      "shadow-[0_0_40px_rgba(239,68,68,0.25)]": status === "outage",
      "shadow-[0_0_40px_rgba(100,116,139,0.25)]": status === "maintenance"
    })}><div${attr_class(`absolute inset-0 bg-[$${stringify(cfg().dot)}]/5 opacity-0 transition-opacity duration-700`)}></div> <div class="relative px-6 py-5 flex items-center justify-between gap-4"><div class="flex items-center gap-3"><div${attr_class(`w-2.5 h-2.5 rounded-full $${stringify(cfg().dot)} animate-pulse shadow-[0_0_10px_currentColor]`)}></div> <div><div class="font-bold text-text">${escape_html(label())}</div> <div class="text-xs text-muted">System health across all nodes</div></div></div> <div${attr_class(`px-3 py-1.5 rounded-full $${stringify(cfg().bg)} $${stringify(cfg().border)} $${stringify(cfg().text)} text-[0.7rem] font-semibold uppercase tracking-wider transition-colors duration-500`)}>${escape_html(label())}</div></div></div>`);
  });
}
function ComponentRow($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { node } = $$props;
    let cfg = derived(() => statusConfig(node.status));
    let borderClass = derived(() => node.status === "operational" ? "border-emerald-500/50" : node.status === "degraded" ? "border-amber-500/50" : node.status === "outage" ? "border-rose-500/50" : "border-slate-500/50");
    let divClass = derived(() => `group relative z-10 overflow-hidden rounded-xl border border-border bg-panel transition-all duration-500 ease-out hover:border-border/60 ${borderClass()}`);
    $$renderer2.push(`<div${attr_class(clsx(divClass()))}><div${attr_class(`absolute inset-0 $${stringify(cfg().dot)}/4 opacity-0 group-hover:opacity-100 transition-opacity duration-300`)}></div> <div class="relative p-5 flex items-start justify-between gap-4"><div class="flex-1 min-w-0"><div class="flex items-center gap-2"><h3 class="font-semibold text-text">${escape_html(node.name)}</h3> <span${attr_class(`w-2 h-2 rounded-full $${stringify(cfg().dot)} animate-pulse shadow-[0_0_8px_currentColor]`)}></span></div> <p class="text-sm text-muted mt-1">${escape_html(node.desc)}</p></div> <div class="flex items-end gap-2"><span${attr_class(`px-2.5 py-1 rounded-lg $${stringify(cfg().bg)} $${stringify(cfg().border)} $${stringify(cfg().text)} text-[0.65rem] font-semibold uppercase tracking-wider whitespace-nowrap`)}>${escape_html(cfg().label)}</span></div></div> <div class="px-5 pb-4 border-t border-border/50"><div class="flex items-end gap-0.5 h-6"><!--[-->`);
    const each_array = ensure_array_like(node.uptimeBlocks);
    for (let i = 0, $$length = each_array.length; i < $$length; i++) {
      let block = each_array[i];
      $$renderer2.push(`<svg width="4" height="6"${attr_class(`$${stringify(statusConfig(block).dot)}`)}${attr_style(`height: calc(6px + ${stringify(i % 4)}px)`)}><rect width="4" height="6" rx="1"></rect></svg>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="flex justify-between mt-2 text-[0.65rem] text-muted"><span>90-day uptime</span> <span>99.9%</span></div></div></div>`);
  });
}
function StatusMatrix($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { nodes } = $$props;
    let nodesWithBlocks = derived(() => nodes.map((n) => ({ ...n, uptimeBlocks: generateUptimeBlocks(n.status) })));
    $$renderer2.push(`<section class="relative z-10">`);
    StatusBanner($$renderer2, {});
    $$renderer2.push(`<!----> <div class="mt-8"><div class="flex items-center justify-between mb-6"><h2 class="font-semibold text-text uppercase tracking-wider text-[0.7rem]">Components</h2></div> <div class="grid md:grid-cols-3 gap-4"><!--[-->`);
    const each_array = ensure_array_like(nodesWithBlocks());
    for (let index = 0, $$length = each_array.length; index < $$length; index++) {
      let node = each_array[index];
      ComponentRow($$renderer2, { node });
    }
    $$renderer2.push(`<!--]--></div></div></section>`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    StatusMatrix($$renderer2, { nodes: data.components, global: data.globalStatus });
  });
}
export {
  _page as default
};
