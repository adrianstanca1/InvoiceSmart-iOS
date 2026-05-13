const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin that patches expo-modules-core Swift files during prebuild.
 * Runs AFTER iOS project generation but BEFORE pod install.
 */
function patchFile(filePath, search, replace) {
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  Skipping ${path.basename(filePath)} (not found)`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes(search)) {
    console.log(`  ⚠️  Already patched or different version: ${path.basename(filePath)}`);
    return false;
  }

  const newContent = content.replace(search, replace);
  if (newContent === content) {
    console.log(`  ⚠️  No changes needed: ${path.basename(filePath)}`);
    return false;
  }

  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`  ✅ Patched ${path.basename(filePath)}`);
  return true;
}

module.exports = function withFixExpoModulesCore(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      console.log('🔧 [fix-expo-modules-core] Patching expo-modules-core for Xcode 16...');

      // Patch all expo-modules-core installations
      const possiblePaths = [
        path.join(config.modRequest.projectRoot, 'node_modules/expo-modules-core/ios'),
        path.join(config.modRequest.projectRoot, 'node_modules/expo/node_modules/expo-modules-core/ios'),
      ];

      let patchedAny = false;

      for (const basePath of possiblePaths) {
        if (!fs.existsSync(basePath)) continue;

        console.log(`🔧 Patching ${basePath}...`);

        // Patch 1: ExpoReactDelegate.swift — wrap UIViewController() in MainActor.assumeIsolated.
        // InvoiceSmart-iOS's expo-modules-core (Expo 55.0.x) has the fallback on a
        // different line than BuildTrack's, so the surrounding context is shorter.
        patchedAny |= patchFile(
          path.join(basePath, 'ReactDelegates/ExpoReactDelegate.swift'),
          '.first(where: { _ in true }) ?? UIViewController()',
          '.first(where: { _ in true }) ?? MainActor.assumeIsolated { UIViewController() }'
        );

        // Patch 2: PersistentFileLog.swift
        patchedAny |= patchFile(
          path.join(basePath, 'Core/Logging/PersistentFileLog.swift'),
          'filter: @escaping PersistentFileLogFilter',
          'filter: @escaping @Sendable PersistentFileLogFilter'
        );

        // Patch 3: SwiftUIHostingView.swift — class declaration
        patchedAny |= patchFile(
          path.join(basePath, 'Core/Views/SwiftUI/SwiftUIHostingView.swift'),
          'public final class HostingView<Props: ViewProps, ContentView: View<Props>>: ExpoView, @MainActor AnyExpoSwiftUIHostingView {',
          'public final class HostingView<Props: ViewProps, ContentView: View<Props>>: ExpoView, AnyExpoSwiftUIHostingView {'
        );

        // Patch 4: SwiftUIHostingView.swift — updateProps
        patchedAny |= patchFile(
          path.join(basePath, 'Core/Views/SwiftUI/SwiftUIHostingView.swift'),
          'public override func updateProps(_ rawProps: [String: Any]) {',
          '@MainActor public override func updateProps(_ rawProps: [String: Any]) {  // @MainActor inherited from class'
        );

        // Patch 5: SwiftUIVirtualView.swift — childViewId
        patchedAny |= patchFile(
          path.join(basePath, 'Core/Views/SwiftUI/SwiftUIVirtualView.swift'),
          'if let child = childComponentView as AnyObject as? (any AnyChild) {',
          'if let child = MainActor.assumeIsolated({ childComponentView as AnyObject as? (any AnyChild) }) {'
        );

        // Patch 6: SwiftUIVirtualView.swift — objectWillChange.send
        patchedAny |= patchFile(
          path.join(basePath, 'Core/Views/SwiftUI/SwiftUIVirtualView.swift'),
          "props.objectWillChange.send()",
          "MainActor.assumeIsolated { props.objectWillChange.send() }"
        );

        // Patch 7: ViewDefinition.swift
        patchedAny |= patchFile(
          path.join(basePath, 'Core/Views/ViewDefinition.swift'),
          'extension UIView: @MainActor AnyArgument {',
          '@MainActor\nextension UIView: AnyArgument {'
        );

        // Patch 8: SwiftUIVirtualView.swift — ViewWrapper extension
        patchedAny |= patchFile(
          path.join(basePath, 'Core/Views/SwiftUI/SwiftUIVirtualView.swift'),
          'extension ExpoSwiftUI.SwiftUIVirtualView: @MainActor ExpoSwiftUI.ViewWrapper {',
          '@MainActor\nextension ExpoSwiftUI.SwiftUIVirtualView: ExpoSwiftUI.ViewWrapper {'
        );
      }

      if (patchedAny) {
        console.log('✅ [fix-expo-modules-core] Patches applied successfully');
      } else {
        console.log('⚠️  [fix-expo-modules-core] No patches applied');
      }

      return config;
    },
  ]);
};
