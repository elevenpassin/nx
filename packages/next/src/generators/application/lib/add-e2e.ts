import {
  addProjectConfiguration,
  ensurePackage,
  getPackageManagerCommand,
  joinPathFragments,
  readNxJson,
  Tree,
} from '@nx/devkit';
import { Linter } from '@nx/eslint';

import { nxVersion } from '../../../utils/versions';
import { NormalizedSchema } from './normalize-options';
import { webStaticServeGenerator } from '@nx/web';
import { findPluginForConfigFile } from '@nx/devkit/src/utils/find-plugin-for-config-file';
import { addE2eCiTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';

export async function addE2e(host: Tree, options: NormalizedSchema) {
  const nxJson = readNxJson(host);
  const hasPlugin = nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/next/plugin'
      : p.plugin === '@nx/next/plugin'
  );

  if (options.e2eTestRunner === 'cypress') {
    const { configurationGenerator } = ensurePackage<
      typeof import('@nx/cypress')
    >('@nx/cypress', nxVersion);

    if (!hasPlugin) {
      await webStaticServeGenerator(host, {
        buildTarget: `${options.projectName}:build`,
        outputPath: `${options.outputPath}/out`,
        targetName: 'serve-static',
        spa: true,
      });
    }

    addProjectConfiguration(host, options.e2eProjectName, {
      root: options.e2eProjectRoot,
      sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
      targets: {},
      tags: [],
      implicitDependencies: [options.projectName],
    });

    const e2eTask = await configurationGenerator(host, {
      ...options,
      linter: Linter.EsLint,
      project: options.e2eProjectName,
      directory: 'src',
      skipFormat: true,
      devServerTarget: `${options.projectName}:${options.e2eWebServerTarget}`,
      baseUrl: options.e2eWebServerAddress,
      jsx: true,
      webServerCommands: hasPlugin
        ? {
            default: `nx run ${options.projectName}:${options.e2eWebServerTarget}`,
          }
        : undefined,
      ciWebServerCommand: hasPlugin
        ? `nx run ${options.projectName}:serve-static`
        : undefined,
    });

    if (
      options.addPlugin ||
      readNxJson(host).plugins?.find((p) =>
        typeof p === 'string'
          ? p === '@nx/cypress/plugin'
          : p.plugin === '@nx/cypress/plugin'
      )
    ) {
      let buildTarget = '^build';
      if (hasPlugin) {
        const matchingPlugin = await findPluginForConfigFile(
          host,
          '@nx/next/plugin',
          joinPathFragments(options.appProjectRoot, 'next.config.js')
        );
        if (matchingPlugin && typeof matchingPlugin !== 'string') {
          buildTarget = `^${
            (matchingPlugin.options as any)?.buildTargetName ?? 'build'
          }`;
        }
      }
      await addE2eCiTargetDefaults(
        host,
        '@nx/cypress/plugin',
        buildTarget,
        joinPathFragments(
          options.e2eProjectRoot,
          `cypress.config.${options.js ? 'js' : 'ts'}`
        )
      );
    }

    return e2eTask;
  } else if (options.e2eTestRunner === 'playwright') {
    const { configurationGenerator } = ensurePackage<
      typeof import('@nx/playwright')
    >('@nx/playwright', nxVersion);
    addProjectConfiguration(host, options.e2eProjectName, {
      root: options.e2eProjectRoot,
      sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
      targets: {},
      tags: [],
      implicitDependencies: [options.projectName],
    });
    const e2eTask = await configurationGenerator(host, {
      rootProject: options.rootProject,
      project: options.e2eProjectName,
      skipFormat: true,
      skipPackageJson: options.skipPackageJson,
      directory: 'src',
      js: false,
      linter: options.linter,
      setParserOptionsProject: options.setParserOptionsProject,
      webServerAddress: `http://127.0.0.1:${options.e2ePort}`,
      webServerCommand: `${getPackageManagerCommand().exec} nx ${
        options.e2eWebServerTarget
      } ${options.projectName}`,
      addPlugin: options.addPlugin,
    });

    if (
      options.addPlugin ||
      readNxJson(host).plugins?.find((p) =>
        typeof p === 'string'
          ? p === '@nx/playwright/plugin'
          : p.plugin === '@nx/playwright/plugin'
      )
    ) {
      let buildTarget = '^build';
      if (hasPlugin) {
        const matchingPlugin = await findPluginForConfigFile(
          host,
          '@nx/next/plugin',
          joinPathFragments(options.appProjectRoot, 'next.config.js')
        );
        if (matchingPlugin && typeof matchingPlugin !== 'string') {
          buildTarget = `^${
            (matchingPlugin.options as any)?.buildTargetName ?? 'build'
          }`;
        }
      }
      await addE2eCiTargetDefaults(
        host,
        '@nx/playwright/plugin',
        buildTarget,
        joinPathFragments(options.e2eProjectRoot, `playwright.config.ts`)
      );
    }

    return e2eTask;
  }
  return () => {};
}
