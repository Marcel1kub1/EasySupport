
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/private';
 * 
 * console.log(ENVIRONMENT); // => "production"
 * console.log(PUBLIC_BASE_URL); // => throws error during build
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/private' {
	export const DISCORD_TOKEN: string;
	export const CLIENT_ID: string;
	export const MYSQL_HOST: string;
	export const MYSQL_PORT: string;
	export const MYSQL_USER: string;
	export const MYSQL_PASSWORD: string;
	export const MYSQL_DATABASE: string;
	export const ADMIN_USER: string;
	export const ADMIN_PASSWORD: string;
	export const SESSION_SECRET: string;
	export const PORT: string;
	export const SVELTEKIT_FORK: string;
	export const NODE_ENV: string;
	export const KONSOLE_DBUS_WINDOW: string;
	export const npm_node_execpath: string;
	export const MAIL: string;
	export const KDE_APPLICATIONS_AS_SCOPE: string;
	export const npm_config_global_prefix: string;
	export const npm_config_noproxy: string;
	export const npm_config_allow_scripts: string;
	export const JOURNAL_STREAM: string;
	export const XDG_RUNTIME_DIR: string;
	export const npm_execpath: string;
	export const _ble_util_fdvars_export: string;
	export const npm_config_user_agent: string;
	export const XDG_SESSION_ID: string;
	export const XDG_VTNR: string;
	export const MOZ_USE_XINPUT2: string;
	export const _ble_util_fdlist_cloexec: string;
	export const SHLVL: string;
	export const DISPLAY: string;
	export const XDG_DATA_DIRS: string;
	export const KDE_SESSION_VERSION: string;
	export const npm_lifecycle_event: string;
	export const bleopt_connect_tty: string;
	export const DRACUT_NO_XATTR: string;
	export const HOMEBREW_CELLAR: string;
	export const COLORFGBG: string;
	export const USER: string;
	export const XDG_SESSION_TYPE: string;
	export const LANGUAGE: string;
	export const PWD: string;
	export const GTK2_RC_FILES: string;
	export const GTK_RC_FILES: string;
	export const KDE_FULL_SESSION: string;
	export const DESKTOP_SESSION: string;
	export const HOMEBREW_PREFIX: string;
	export const COLOR: string;
	export const PAM_KWALLET5_LOGIN: string;
	export const SHELL_SESSION_ID: string;
	export const STARSHIP_SESSION_KEY: string;
	export const npm_config_node_gyp: string;
	export const SHELL: string;
	export const npm_config_globalconfig: string;
	export const LIBVA_DRIVER_NAME: string;
	export const npm_config_npm_version: string;
	export const MEMORY_PRESSURE_WRITE: string;
	export const COLORTERM: string;
	export const LOGNAME: string;
	export const npm_command: string;
	export const EDITOR: string;
	export const npm_package_engines_node: string;
	export const SESSION_MANAGER: string;
	export const NODE: string;
	export const INVOCATION_ID: string;
	export const WINDOWID: string;
	export const XDG_SESSION_DESKTOP: string;
	export const XDG_SESSION_PATH: string;
	export const npm_config_init_module: string;
	export const npm_config_cache: string;
	export const npm_package_name: string;
	export const XDG_MENU_PREFIX: string;
	export const npm_config_prefix: string;
	export const BLE_SESSION_ID: string;
	export const QT_DISABLE_HW_TEXTURES_CONVERSION: string;
	export const QT_WAYLAND_RECONNECT: string;
	export const PROFILEHOME: string;
	export const DBUS_SESSION_BUS_ADDRESS: string;
	export const npm_package_json: string;
	export const AUTOSUGGEST_HOOKS_COLOR: string;
	export const KONSOLE_VERSION: string;
	export const SYSTEMD_EXEC_PID: string;
	export const npm_config_local_prefix: string;
	export const XAUTHORITY: string;
	export const HOME: string;
	export const LANG: string;
	export const PATH: string;
	export const ICEAUTHORITY: string;
	export const KDE_SESSION_UID: string;
	export const _: string;
	export const XDG_CURRENT_DESKTOP: string;
	export const KONSOLE_DBUS_SERVICE: string;
	export const XDG_SEAT: string;
	export const LINENO: string;
	export const npm_package_version: string;
	export const npm_lifecycle_script: string;
	export const MOTD_SHOWN: string;
	export const STARSHIP_SHELL: string;
	export const MOZ_ENABLE_WAYLAND: string;
	export const WAYLAND_DISPLAY: string;
	export const npm_config_userconfig: string;
	export const MEMORY_PRESSURE_WATCH: string;
	export const KONSOLE_DBUS_SESSION: string;
	export const BUN_INSTALL: string;
	export const XDG_SEAT_PATH: string;
	export const MANAGERPID: string;
	export const DEBUGINFOD_URLS: string;
	export const HOMEBREW_REPOSITORY: string;
	export const INIT_CWD: string;
	export const INFOPATH: string;
	export const XDG_SESSION_CLASS: string;
	export const XDG_CONFIG_DIRS: string;
	export const TERM: string;
}

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/public';
 * 
 * console.log(ENVIRONMENT); // => throws error during build
 * console.log(PUBLIC_BASE_URL); // => "http://site.com"
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * 
 * console.log(env.ENVIRONMENT); // => "production"
 * console.log(env.PUBLIC_BASE_URL); // => undefined
 * ```
 */
declare module '$env/dynamic/private' {
	export const env: {
		DISCORD_TOKEN: string;
		CLIENT_ID: string;
		MYSQL_HOST: string;
		MYSQL_PORT: string;
		MYSQL_USER: string;
		MYSQL_PASSWORD: string;
		MYSQL_DATABASE: string;
		ADMIN_USER: string;
		ADMIN_PASSWORD: string;
		SESSION_SECRET: string;
		PORT: string;
		SVELTEKIT_FORK: string;
		NODE_ENV: string;
		KONSOLE_DBUS_WINDOW: string;
		npm_node_execpath: string;
		MAIL: string;
		KDE_APPLICATIONS_AS_SCOPE: string;
		npm_config_global_prefix: string;
		npm_config_noproxy: string;
		npm_config_allow_scripts: string;
		JOURNAL_STREAM: string;
		XDG_RUNTIME_DIR: string;
		npm_execpath: string;
		_ble_util_fdvars_export: string;
		npm_config_user_agent: string;
		XDG_SESSION_ID: string;
		XDG_VTNR: string;
		MOZ_USE_XINPUT2: string;
		_ble_util_fdlist_cloexec: string;
		SHLVL: string;
		DISPLAY: string;
		XDG_DATA_DIRS: string;
		KDE_SESSION_VERSION: string;
		npm_lifecycle_event: string;
		bleopt_connect_tty: string;
		DRACUT_NO_XATTR: string;
		HOMEBREW_CELLAR: string;
		COLORFGBG: string;
		USER: string;
		XDG_SESSION_TYPE: string;
		LANGUAGE: string;
		PWD: string;
		GTK2_RC_FILES: string;
		GTK_RC_FILES: string;
		KDE_FULL_SESSION: string;
		DESKTOP_SESSION: string;
		HOMEBREW_PREFIX: string;
		COLOR: string;
		PAM_KWALLET5_LOGIN: string;
		SHELL_SESSION_ID: string;
		STARSHIP_SESSION_KEY: string;
		npm_config_node_gyp: string;
		SHELL: string;
		npm_config_globalconfig: string;
		LIBVA_DRIVER_NAME: string;
		npm_config_npm_version: string;
		MEMORY_PRESSURE_WRITE: string;
		COLORTERM: string;
		LOGNAME: string;
		npm_command: string;
		EDITOR: string;
		npm_package_engines_node: string;
		SESSION_MANAGER: string;
		NODE: string;
		INVOCATION_ID: string;
		WINDOWID: string;
		XDG_SESSION_DESKTOP: string;
		XDG_SESSION_PATH: string;
		npm_config_init_module: string;
		npm_config_cache: string;
		npm_package_name: string;
		XDG_MENU_PREFIX: string;
		npm_config_prefix: string;
		BLE_SESSION_ID: string;
		QT_DISABLE_HW_TEXTURES_CONVERSION: string;
		QT_WAYLAND_RECONNECT: string;
		PROFILEHOME: string;
		DBUS_SESSION_BUS_ADDRESS: string;
		npm_package_json: string;
		AUTOSUGGEST_HOOKS_COLOR: string;
		KONSOLE_VERSION: string;
		SYSTEMD_EXEC_PID: string;
		npm_config_local_prefix: string;
		XAUTHORITY: string;
		HOME: string;
		LANG: string;
		PATH: string;
		ICEAUTHORITY: string;
		KDE_SESSION_UID: string;
		_: string;
		XDG_CURRENT_DESKTOP: string;
		KONSOLE_DBUS_SERVICE: string;
		XDG_SEAT: string;
		LINENO: string;
		npm_package_version: string;
		npm_lifecycle_script: string;
		MOTD_SHOWN: string;
		STARSHIP_SHELL: string;
		MOZ_ENABLE_WAYLAND: string;
		WAYLAND_DISPLAY: string;
		npm_config_userconfig: string;
		MEMORY_PRESSURE_WATCH: string;
		KONSOLE_DBUS_SESSION: string;
		BUN_INSTALL: string;
		XDG_SEAT_PATH: string;
		MANAGERPID: string;
		DEBUGINFOD_URLS: string;
		HOMEBREW_REPOSITORY: string;
		INIT_CWD: string;
		INFOPATH: string;
		XDG_SESSION_CLASS: string;
		XDG_CONFIG_DIRS: string;
		TERM: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://example.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.ENVIRONMENT); // => undefined, not public
 * console.log(env.PUBLIC_BASE_URL); // => "http://example.com"
 * ```
 * 
 * ```
 * 
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
