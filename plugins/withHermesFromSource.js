const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to force Hermes compilation from source on iOS.
 * 
 * This fixes the "Undefined symbols for architecture arm64" linker error
 * caused by C++ ABI mismatches between prebuilt Hermes binaries and locally
 * compiled native modules (reanimated, worklets, expo-modules-core) on
 * Xcode 16+ / EAS Build.
 * 
 * By setting HERMES_USE_PREBUILT=false and BUILD_FROM_SOURCE=true,
 * all C++ code is compiled with the same toolchain, ensuring ABI tag alignment.
 */
module.exports = function withHermesFromSource(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfile = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      
      if (!fs.existsSync(podfile)) {
        return config;
      }

      let contents = fs.readFileSync(podfile, 'utf8');

      // Inject environment variables to force source compilation of Hermes
      const envInjection = `ENV['HERMES_USE_PREBUILT'] = 'false'\nENV['BUILD_FROM_SOURCE'] = 'true'\n`;

      if (!contents.includes("ENV['HERMES_USE_PREBUILT'] = 'false'")) {
        contents = envInjection + contents;
        fs.writeFileSync(podfile, contents);
      }

      return config;
    },
  ]);
};
