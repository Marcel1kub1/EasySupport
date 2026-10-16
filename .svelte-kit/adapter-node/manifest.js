export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.Cpwet3Cl.js",app:"_app/immutable/entry/app.Bd-MzZtZ.js",imports:["_app/immutable/entry/start.Cpwet3Cl.js","_app/immutable/chunks/BfHyAIdK.js","_app/immutable/chunks/J8HUJKSG.js","_app/immutable/chunks/DfZjgPC2.js","_app/immutable/chunks/COw9Ckaq.js","_app/immutable/entry/app.Bd-MzZtZ.js","_app/immutable/chunks/J8HUJKSG.js","_app/immutable/chunks/JB-vZ1gV.js","_app/immutable/chunks/DfZjgPC2.js","_app/immutable/chunks/DIzsgSfT.js","_app/immutable/chunks/DuPZ8LaB.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/login",
				pattern: /^\/login\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/status",
				pattern: /^\/status\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();

export const prerendered = new Set([]);
