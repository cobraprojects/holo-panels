# Install Holo Panels

This guide describes the commands and package entry points implemented in the current repository. It assumes an existing Holo application using Next.js, Nuxt, or SvelteKit.

## Prerequisites

Your application must already have:

- the Holo CLI available as `holo`;
- one configured Holo framework adapter: Next.js, Nuxt, or SvelteKit;
- `config/app.ts` or another app-config module known to the loaded Holo project; and
- a configured authentication guard for the panel you will create.

Holo Panels uses the existing Holo CLI and runtime. It does not install a separate executable.

## Add and activate the plugin

Run this command from the application root:

```sh
holo plugin:add @holo-js/panels
```

The Holo `plugin:add` command installs the umbrella package and activates it in the app config. The resulting `plugins` array must contain `@holo-js/panels` exactly once:

```ts
export default defineAppConfig({
  plugins: ['@holo-js/panels'],
})
```

Keep the application's other config properties. The snippet shows only the relevant property.

The installed umbrella package exposes its Holo plugin through its package manifest and contributes the Panels commands, runtime boot module, migrations publisher, and project preparer.

Panels also contributes `@holo-js/security`. Holo installs that dependency and runs its existing idempotent security
scaffold during `plugin:add`, creating `config/security.ts` with the file-backed rate-limit driver when the application
does not already have security configuration. Panel MFA therefore requires no separate security installation or
manual config file creation.

## Install the matching Panels adapter

Run:

```sh
holo panels:install
```

The command detects one framework from Holo's generated framework descriptor or the application's dependencies. It installs exactly one adapter at the same exact version as `@holo-js/panels`:

| Detected application | Installed adapter | Renderer dependency |
| --- | --- | --- |
| Next.js | `@holo-js/panels-next` | `@holo-js/panels-react` |
| Nuxt | `@holo-js/panels-nuxt` | `@holo-js/panels-vue` |
| SvelteKit | `@holo-js/panels-sveltekit` | `@holo-js/panels-svelte` |

The adapter is added to `dependencies`. Installation ownership is recorded in `.holo-js/panels/install.json`. Re-running the command is safe when the recorded installation and installed package still match.

The command refuses ambiguous framework detection, conflicting adapters, an invalid or mismatched installed package, malformed ownership state, and symbolic links in paths it manages.

## Prepare generated artifacts

Run:

```sh
holo prepare
```

The Panels project preparer discovers panel definitions below `server/` and writes generated metadata below:

```text
.holo-js/generated/panels/
```

The generated tree includes `server-registry.ts`, client manifests, definition indexes, type augmentation, and framework-artifact ownership. Do not edit generated files.

Once a panel exists, preparation also requests thin framework-native route files. These carry a managed checksum header. Holo Panels updates a managed route only while its previous checksum still matches and refuses to replace an unmanaged or locally modified route.

The generated route paths differ by framework:

| Framework | Panel page for a panel at `/admin` | Operation endpoint |
| --- | --- | --- |
| Next.js | `app/admin/[[...panelsPath]]/page.tsx` | `app/%5Fholo/panels/[panelId]/[operation]/route.ts` |
| Nuxt | `pages/admin/[[...panelsPath]].vue` | `server/api/_holo/panels/[panelId]/[operation].ts` |
| SvelteKit | `src/routes/admin/[...path]/+page.server.ts` and `+page.svelte` | `src/routes/_holo/panels/[panelId]/[operation]/+server.ts` |

Next.js requires the encoded `%5Fholo` filesystem segment so the App Router does not treat `_holo` as a private folder. Requests still use `/_holo/panels/...`.

Panel generators invoke `holo prepare` after writing their files. Run it again after manually changing discoverable panel, page, resource, widget, or cluster definitions.

## What remains application-owned

The generated route files intentionally import an application-owned server binding. You must provide it before the panel route can typecheck or run:

| Framework | Required binding |
| --- | --- |
| Next.js | `server/panels/runtime.ts` exporting `panelsRuntime` compatible with `NextPanelsRuntime` |
| Nuxt | `server/panels/runtime.ts` exporting `panelsRuntime` compatible with `NuxtPanelRuntime` |
| SvelteKit | `src/lib/server/panels/registry.ts` exporting `panelsRegistry` compatible with `SvelteKitPanelRegistry` |

This binding owns application-specific authentication, tenant and service resolution, page data, authorization, and operation execution. Holo Panels does not generate those security decisions.

Continue with [Create your first panel](first-panel.md) for the declaration, page, runtime-binding references, and framework-specific route result.

## Remove the installed adapter

Run:

```sh
holo panels:uninstall
```

This removes only the adapter dependency that `panels:install` still owns and its install ownership record. It preserves the `@holo-js/panels` plugin activation, panel and resource source, generated or user-owned application files, and any published UI source.

To remove the plugin itself, use Holo's plugin removal workflow separately after deciding what application source to retain.

## Troubleshooting

`@holo-js/panels must appear exactly once` means the package is installed but its plugin activation is missing or duplicated in the loaded app config. Use `holo plugin:add @holo-js/panels` for the normal activation path.

`Multiple frameworks detected` means dependencies or the generated framework descriptor identify more than one supported adapter. Resolve the application framework configuration before retrying.

`Refusing symlinked project path` or an unmanaged-file conflict is a safety stop. Replace the symlink or integrate the printed route snippet manually; do not bypass the check by overwriting the destination.

`Next runtime is unavailable` or a missing Panels registry means the application-owned binding in the table above has not been exported to the path used by the generated route.
