const { withPodfile } = require('@expo/config-plugins');

/**
 * Config plugin to disable Swift 6 strict concurrency in the Podfile.
 * Merges settings into the EXISTING post_install block (Ruby only allows one).
 */
function withPodfileSwiftConcurrencyFix(config) {
  return withPodfile(config, (config) => {
    const podfile = config.modResults.contents || config.modResults;
    
    if (typeof podfile !== 'string') {
      console.log('[podfile-swift-concurrency] Warning: podfile.contents is not a string');
      return config;
    }
    
    // Complete Swift concurrency settings block
    // Must include installer.pods_project.targets.each wrapper since 'target' variable
    // only exists inside that loop in Ruby.
    const settings = `
  # Swift 6 strict concurrency fix for Xcode 16
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
      # NOTE: don't force SWIFT_VERSION='5.0' (which BuildTrack's original plugin does).
      # InvoiceSmart-iOS uses a newer expo-modules-core that has `@MainActor`
      # attributes (Swift 5.5+). Forcing 5.0 makes the compiler reject them.
      # SWIFT_STRICT_CONCURRENCY=minimal alone fixes the Swift 6 concurrency
      # errors without breaking @MainActor syntax.
      config.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
      config.build_settings['SWIFT_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
    end
  end
`;
    
    // Check if already patched
    if (podfile.includes("SWIFT_STRICT_CONCURRENCY")) {
      console.log('[podfile-swift-concurrency] Already patched');
      return config;
    }
    
    // Find existing post_install block and inject settings inside it
    const postInstallMatch = podfile.match(/(post_install\s+do\s*\|installer\|)/);
    if (postInstallMatch) {
      const insertIndex = postInstallMatch.index + postInstallMatch[1].length;
      const before = podfile.slice(0, insertIndex);
      const after = podfile.slice(insertIndex);
      config.modResults = {
        ...config.modResults,
        contents: before + "\n" + settings + after,
      };
      console.log('[podfile-swift-concurrency] Merged Swift concurrency settings into existing post_install block');
      return config;
    }
    
    // If no post_install block exists, add one at the end
    const hook = `
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
      # NOTE: don't force SWIFT_VERSION='5.0' (which BuildTrack's original plugin does).
      # InvoiceSmart-iOS uses a newer expo-modules-core that has `@MainActor`
      # attributes (Swift 5.5+). Forcing 5.0 makes the compiler reject them.
      # SWIFT_STRICT_CONCURRENCY=minimal alone fixes the Swift 6 concurrency
      # errors without breaking @MainActor syntax.
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
    console.log('[podfile-swift-concurrency] Added post_install block with Swift concurrency settings');
    return config;
  });
}

module.exports = withPodfileSwiftConcurrencyFix;
