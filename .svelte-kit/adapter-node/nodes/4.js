import * as server from '../entries/pages/status/_page.server.js';

export const index = 4;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/status/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/status/+page.server.js";
export const imports = ["_app/immutable/nodes/4.6GRAaBh1.js","_app/immutable/chunks/JB-vZ1gV.js","_app/immutable/chunks/J8HUJKSG.js","_app/immutable/chunks/DfZjgPC2.js","_app/immutable/chunks/DtDFkiwr.js"];
export const stylesheets = [];
export const fonts = [];
