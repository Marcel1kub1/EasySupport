import { e as escape_html } from './attributes-CMMjMIGF.js';
import './state.svelte-CxH4NiCo.js';
import './root-B_f1OIs6.js';
import { p as getContext } from './index-CkMI0j-Y.js';

function context() {
  return getContext("__request__");
}
const page$1 = {
  get error() {
    return context().page.error;
  },
  get status() {
    return context().page.status;
  }
};
const page = page$1;
function Error$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<h1>${escape_html(page.status)}</h1> <p>${escape_html(page.error?.message)}</p>`);
  });
}

export { Error$1 as default };
//# sourceMappingURL=error.svelte-qMShb4cZ.js.map
