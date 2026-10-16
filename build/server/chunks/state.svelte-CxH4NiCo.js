import { n as noop } from './attributes-CMMjMIGF.js';
import './root-B_f1OIs6.js';

const is_legacy = noop.toString().includes("$$") || /function \w+\(\) \{\}/.test(noop.toString());
const placeholder_url = "a:";
if (is_legacy) {
  ({
    url: new URL(placeholder_url)
  });
} else {
  new class Page {
    data = {};
    form = null;
    error = null;
    params = {};
    route = { id: null };
    state = {};
    status = -1;
    url = new URL(placeholder_url);
  }();
}
//# sourceMappingURL=state.svelte-CxH4NiCo.js.map
