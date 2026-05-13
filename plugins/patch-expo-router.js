const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin that patches expo-router for older Xcode toolchains (Xcode 16/17
 * default macos-latest, which doesn't have iOS 26 SDK headers).
 *
 * Ported from BuildTrack's scripts/patch-expo-router.js (commits 129d228 + 3938eaa)
 * but wrapped as an Expo config plugin so it runs during prebuild, not via
 * package.json postinstall (which the InvoiceSmart-iOS team is iterating on).
 *
 * iOS 26.0 introduced these APIs that expo-router 55.0.14 uses behind
 * `if #available(iOS 26.0, *)` guards:
 *   - UIBarButtonItem.Style.prominent
 *   - UIBarButtonItem.hidesSharedBackground / .sharesBackground
 *   - UIBarButtonItem.Badge / .badge
 *   - UINavigationItem.searchBarPlacementBarButtonItem
 *
 * Swift's `#available` is a runtime check — the compiler still needs the
 * symbols in the SDK headers. Xcode <17 lacks them → strip the blocks.
 *
 * Patches are idempotent — script no-ops if strings drift (logs a warning).
 */

function patchFile(filePath, search, replace, label) {
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  Skipping ${label} — file missing`);
    return false;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes(search)) {
    console.log(`  ⚠️  ${label}: already patched or string drift`);
    return false;
  }
  const newContent = content.replace(search, replace);
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`  ✅ ${label}`);
  return true;
}

module.exports = function withPatchExpoRouter(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      console.log('🔧 [patch-expo-router] Patching expo-router for iOS<26 SDK...');

      const possiblePaths = [
        path.join(config.modRequest.projectRoot, 'node_modules/expo-router/ios'),
        path.join(config.modRequest.projectRoot, 'node_modules/expo/node_modules/expo-router/ios'),
      ];

      let patchedAny = false;
      for (const basePath of possiblePaths) {
        if (!fs.existsSync(basePath)) continue;
        console.log(`🔧 Patching ${basePath}...`);

        // 1. RouterToolbarModule.swift: .prominent style case
        patchedAny |= patchFile(
          path.join(basePath, 'Toolbar/RouterToolbarModule.swift'),
          `    case .prominent:
      if #available(iOS 26.0, *) {
        return .prominent
      } else {
        return .done
      }`,
          `    case .prominent:
      return .done`,
          'RouterToolbarModule.swift: .prominent → .done'
        );

        // 2. RouterToolbarHostView.swift: hidesSharedBackground/sharesBackground on menu
        patchedAny |= patchFile(
          path.join(basePath, 'Toolbar/RouterToolbarHostView.swift'),
          `            if #available(iOS 26.0, *) {
              if let hidesSharedBackground = menu.hidesSharedBackground {
                item.hidesSharedBackground = hidesSharedBackground
              }
              if let sharesBackground = menu.sharesBackground {
                item.sharesBackground = sharesBackground
              }
            }
`,
          `            // [patched for iOS<26 SDK] hidesSharedBackground / sharesBackground stripped
`,
          'RouterToolbarHostView.swift: hidesSharedBackground/sharesBackground (menu)'
        );

        // 3. RouterToolbarItemView.swift: searchBar branch (uses searchBarPlacementBarButtonItem)
        patchedAny |= patchFile(
          path.join(basePath, 'Toolbar/RouterToolbarItemView.swift'),
          `    } else if type == .searchBar {
      guard #available(iOS 26.0, *), let controller = self.host?.findViewController() else {
        // Check for iOS 26, should already be guarded by the JS side, so this warning will only fire if controller is nil
        logger?.warn(
          "[expo-router] navigationItem.searchBarPlacementBarButtonItem not available. This is most likely a bug in expo-router."
        )
        currentBarButtonItem = nil
        return
      }
      guard let navController = controller.navigationController else {
        currentBarButtonItem = nil
        return
      }
      guard navController.isNavigationBarHidden == false else {
        logger?.warn(
          "[expo-router] Toolbar.SearchBarPreferredSlot should only be used when stack header is shown."
        )
        currentBarButtonItem = nil
        return
      }

      item = controller.navigationItem.searchBarPlacementBarButtonItem
    } else {`,
          `    } else if type == .searchBar {
      // [patched for iOS<26 SDK] searchBarPlacementBarButtonItem unavailable; toolbar search slot is a no-op
      logger?.warn(
        "[expo-router] navigationItem.searchBarPlacementBarButtonItem requires iOS 26 SDK; disabled in this build."
      )
      currentBarButtonItem = nil
      return
    } else {`,
          'RouterToolbarItemView.swift: searchBar branch (searchBarPlacementBarButtonItem)'
        );

        // 4. RouterToolbarItemView.swift: applyCommonProperties hidesSharedBackground/sharesBackground
        patchedAny |= patchFile(
          path.join(basePath, 'Toolbar/RouterToolbarItemView.swift'),
          `    if #available(iOS 26.0, *) {
      item.hidesSharedBackground = hidesSharedBackground
      item.sharesBackground = sharesBackground
    }
`,
          `    // [patched for iOS<26 SDK] hidesSharedBackground / sharesBackground stripped
`,
          'RouterToolbarItemView.swift: applyCommonProperties hidesSharedBackground/sharesBackground'
        );

        // 5. RouterToolbarItemView.swift: Badge configuration block
        patchedAny |= patchFile(
          path.join(basePath, 'Toolbar/RouterToolbarItemView.swift'),
          `    if #available(iOS 26.0, *) {
      if let badgeConfig = badgeConfiguration {
        var badge = UIBarButtonItem.Badge.indicator()
        if let value = badgeConfig.value {
          badge = .string(value)
        }
        if let backgroundColor = badgeConfig.backgroundColor {
          badge.backgroundColor = backgroundColor
        }
        if let foregroundColor = badgeConfig.color {
          badge.foregroundColor = foregroundColor
        }
        if badgeConfig.fontFamily != nil || badgeConfig.fontSize != nil
          || badgeConfig.fontWeight != nil {
          let font = RouterFontUtils.convertTitleStyleToFont(
            TitleStyle(
              fontFamily: badgeConfig.fontFamily,
              fontSize: badgeConfig.fontSize,
              fontWeight: badgeConfig.fontWeight
            ))
          badge.font = font
        }
        item.badge = badge
      } else {
        item.badge = nil
      }
    }
`,
          `    // [patched for iOS<26 SDK] UIBarButtonItem.Badge / .badge unavailable; badge config stripped
`,
          'RouterToolbarItemView.swift: Badge configuration block'
        );
      }

      if (patchedAny) {
        console.log('✅ [patch-expo-router] Patches applied successfully');
      } else {
        console.log('⚠️  [patch-expo-router] No patches applied (already patched or string drift)');
      }

      return config;
    },
  ]);
};
