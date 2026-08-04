import { defineHoloPlugin } from '@holo-js/kernel'

export {
  DuplicateRegistrationError,
  ExtensionRegistry,
  MissingRendererError,
  PluginCompatibilityError,
  PanelPluginBuilder,
  assertPluginCompatible,
  createExtensionTypeId,
  definePanelPlugin,
} from '@holo-js/panels-core'
export type {
  ComponentDefault,
  DefaultableComponentKind,
  ExtensionRegistration,
  ExtensionTypeId,
  PanelAssetKind,
  PanelAssetManifest,
  PanelAuthorizationLayer,
  PanelAuthorizationRequest,
  PanelGeneratorTemplate,
  PanelIconDefinition,
  PanelIconPath,
  PanelPackageModuleContribution,
  PanelPermissionSubject,
  PanelPlugin,
  PanelPluginAsset,
  PanelPluginContribution,
  PanelPluginContributionDefinition,
  PanelPluginIcon,
  PanelPluginInstallation,
  PanelRendererFramework,
  PanelRendererRegistration,
  PanelsConfiguration,
  PanelTranslationContribution,
  PluginCompatibility,
  RegistryKind,
  VersionRange,
} from '@holo-js/panels-core'

export const plugin = defineHoloPlugin({
  id: 'panels',
  name: 'Holo Panels',
  description: 'Official resource-driven panel system for Holo-JS',
  contributes: {
    dependencies: {
      holo: ['@holo-js/security'],
    },
    cli: {
      commands: './dist/commands.mjs',
    },
    runtime: {
      boot: './dist/runtime.mjs',
    },
    migrations: {
      publish: './dist/migrations.mjs',
    },
    project: {
      prepare: './dist/prepare.mjs',
    },
  },
} as const)

export default plugin
