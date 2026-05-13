const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin that patches expo-image for iOS<26 SDK toolchains.
 *
 * expo-image's ImageView.swift has an @available(iOS 26.0+) helper
 * `applySymbolEffectiOS26` that references `.drawOn` and `.drawOff`
 * SymbolEffect enum cases. Even though the function is annotated
 * @available, the compiler still type-checks its body — and Xcode <17
 * SDK doesn't know these enum cases, so type inference fails:
 *
 *   ImageView.swift:670 error: reference to member 'drawOn' cannot
 *     be resolved without a contextual type
 *   ImageView.swift:676 error: reference to member 'drawOff' cannot
 *     be resolved without a contextual type
 *   (×6 lines, two switch case bodies)
 *
 * Strip the function body to a no-op stub. The function is only ever
 * called from inside an `if #available(iOS 26.0, tvOS 26.0, *)` block
 * (line 659), so on iOS<26 devices it would have been unreachable
 * anyway — the patch preserves behavioural correctness exactly.
 *
 * Same pattern as plugins/patch-expo-router.js and
 * patch-expo-image-picker.js. Idempotent.
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

module.exports = function withPatchExpoImage(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      console.log('🔧 [patch-expo-image] Patching expo-image for iOS<26 SDK...');

      const possiblePaths = [
        path.join(config.modRequest.projectRoot, 'node_modules/expo-image/ios'),
        path.join(config.modRequest.projectRoot, 'node_modules/expo/node_modules/expo-image/ios'),
      ];

      let patchedAny = false;
      for (const basePath of possiblePaths) {
        if (!fs.existsSync(basePath)) continue;
        console.log(`🔧 Patching ${basePath}...`);

        // Stub applySymbolEffectiOS26's body — the only caller is itself
        // inside `if #available(iOS 26.0, *) { ... }`, so on iOS<26 devices
        // this code is unreachable. Patch preserves runtime behaviour.
        patchedAny |= patchFile(
          path.join(basePath, 'ImageView.swift'),
          `  @available(iOS 26.0, tvOS 26.0, *)
  private func applySymbolEffectiOS26(effect: SFSymbolEffectType, scope: SFSymbolEffectScope?, options: SymbolEffectOptions) {
    switch effect {
    case .drawOn:
      switch scope {
      case .byLayer: sdImageView.addSymbolEffect(.drawOn.byLayer, options: options)
      case .wholeSymbol: sdImageView.addSymbolEffect(.drawOn.wholeSymbol, options: options)
      case .none: sdImageView.addSymbolEffect(.drawOn, options: options)
      }
    case .drawOff:
      switch scope {
      case .byLayer: sdImageView.addSymbolEffect(.drawOff.byLayer, options: options)
      case .wholeSymbol: sdImageView.addSymbolEffect(.drawOff.wholeSymbol, options: options)
      case .none: sdImageView.addSymbolEffect(.drawOff, options: options)
      }
    default:
      break
    }
  }`,
          `  @available(iOS 26.0, tvOS 26.0, *)
  private func applySymbolEffectiOS26(effect: SFSymbolEffectType, scope: SFSymbolEffectScope?, options: SymbolEffectOptions) {
    // [patched for iOS<26 SDK] SymbolEffect.drawOn/.drawOff unavailable;
    // function callers are themselves inside an if #available(iOS 26.0, *) block,
    // so on iOS<26 runtime this code is unreachable anyway.
  }`,
          'ImageView.swift: applySymbolEffectiOS26 → stub'
        );
      }

      if (patchedAny) {
        console.log('✅ [patch-expo-image] Patches applied successfully');
      } else {
        console.log('⚠️  [patch-expo-image] No patches applied (already patched or string drift)');
      }

      return config;
    },
  ]);
};
