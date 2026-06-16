const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to fix iOS C++ ABI mismatch on Xcode 16+.
 * 
 * Forces all CocoaPods targets to use C++20 standard and disables prebuilt
 * Hermes binaries, ensuring ABI tag alignment across all native modules.
 * 
 * This fixes "Undefined symbols for architecture arm64" linker errors caused
 * by mismatched libc++ inline namespace tags between prebuilt frameworks
 * and locally compiled modules.
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

      // 1. Force Hermes to compile from source (prevents ABI mismatch)
      const envInjection = `# Force Hermes from source to prevent C++ ABI mismatch with Xcode 16+
ENV['HERMES_USE_PREBUILT'] = 'false'
ENV['BUILD_FROM_SOURCE'] = 'true'
`;

      // 2. Post-install hook to align C++ standard across all pods
      const postInstallHook = `
# Fix C++ ABI alignment for all pods (Xcode 16+ compatibility)
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
    end
  end
end
`;

      let modified = false;

      if (!contents.includes("ENV['HERMES_USE_PREBUILT']")) {
        contents = envInjection + contents;
        modified = true;
      }

      if (!contents.includes("CLANG_CXX_LANGUAGE_STANDARD")) {
        contents = contents + "\n" + postInstallHook;
        modified = true;
      }

      if (modified) {
        fs.writeFileSync(podfile, contents);
      }

      return config;
    },
  ]);
};
