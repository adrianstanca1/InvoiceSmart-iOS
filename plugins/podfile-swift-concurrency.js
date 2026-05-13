const { withPodfile } = require('@expo/config-plugins');

function withPodfileSwiftConcurrencyFix(config) {
  return withPodfile(config, (config) => {
    const podfile = config.modResults.contents || config.modResults;

    if (typeof podfile !== 'string') {
      console.log('[podfile-swift-concurrency] Warning: podfile.contents is not a string');
      return config;
    }

    const settings = `
  # Swift 6 strict concurrency fix for Xcode 16 (Ruby comment — '//' would be a syntax error in the Podfile)
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
      # Force Swift 5 language mode for pods so they don't inherit Xcode 17's
      # Swift 6 default. Swift 5 mode recognises @MainActor (5.5+) AND has
      # strict concurrency opt-in (off by default; SWIFT_STRICT_CONCURRENCY
      # above keeps it minimal even if something flips it on).
      # NOTE: do NOT use '5.0' (literal 5.0 syntax — predates @MainActor).
      config.build_settings['SWIFT_VERSION'] = '5'
      config.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
      config.build_settings['SWIFT_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
    end
  end
`;

    if (podfile.includes("SWIFT_STRICT_CONCURRENCY")) {
      console.log('[podfile-swift-concurrency] Already patched');
      return config;
    }

    const postInstallMatch = podfile.match(/(post_install\s+do\s*\|installer\|)/);
    if (postInstallMatch) {
      const insertIndex = postInstallMatch.index + postInstallMatch[1].length;
      const before = podfile.slice(0, insertIndex);
      const after = podfile.slice(insertIndex);
      config.modResults = {
        ...config.modResults,
        contents: before + "\n" + settings + after,
      };
      console.log('[podfile-swift-concurrency] Merged into existing post_install block');
      return config;
    }

    const hook = `
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
      # Force Swift 5 language mode for pods so they don't inherit Xcode 17's
      # Swift 6 default. Swift 5 mode recognises @MainActor (5.5+) AND has
      # strict concurrency opt-in (off by default; SWIFT_STRICT_CONCURRENCY
      # above keeps it minimal even if something flips it on).
      # NOTE: do NOT use '5.0' (literal 5.0 syntax — predates @MainActor).
      config.build_settings['SWIFT_VERSION'] = '5'
      config.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
      config.build_settings['SWIFT_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
    end
  end
end
`;

    config.modResults = {
      ...config.modResults,
      contents: podfile + "\n" + hook,
    };
    console.log('[podfile-swift-concurrency] Added post_install block');
    return config;
  });
}

module.exports = withPodfileSwiftConcurrencyFix;
