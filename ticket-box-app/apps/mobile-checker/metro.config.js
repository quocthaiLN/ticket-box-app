const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Force React, React DOM, and React Native to resolve to single instances in the root workspace node_modules
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === 'react' ||
    moduleName.startsWith('react/') ||
    moduleName === 'react-dom' ||
    moduleName.startsWith('react-dom/') ||
    moduleName === 'react-native' ||
    moduleName.startsWith('react-native/')
  ) {
    try {
      const resolvedPath = require.resolve(moduleName, {
        paths: [path.resolve(workspaceRoot, 'node_modules')],
      });
      return {
        filePath: resolvedPath,
        type: 'sourceFile',
      };
    } catch (e) {
      // Fallback to default resolver if custom resolution fails
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
