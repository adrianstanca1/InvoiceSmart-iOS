const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin that patches expo-image-picker for iOS<26 SDK toolchains.
 *
 * expo-image-picker 55.0.20's MediaHandler.swift uses iOS 26 APIs:
 *   - PHAsset.contentType (line 300)
 *   - PHAssetResource.contentType (line 309)
 *
 * They're guarded by `if #available(iOS 26.0, *)` but Swift's #available
 * is a runtime check — the compiler still needs the symbols in SDK
 * headers. Xcode <17 doesn't have iOS 26 SDK, so the whole compile fails.
 *
 * Strip the iOS-26 branch and use only the fallback. Result: iOS<26
 * MIME-type inference works exactly as before (was the else-branch anyway).
 *
 * Same pattern as plugins/patch-expo-router.js. Idempotent.
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

module.exports = function withPatchExpoImagePicker(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      console.log('🔧 [patch-expo-image-picker] Patching expo-image-picker for iOS<26 SDK...');

      const possiblePaths = [
        path.join(config.modRequest.projectRoot, 'node_modules/expo-image-picker/ios'),
        path.join(config.modRequest.projectRoot, 'node_modules/expo/node_modules/expo-image-picker/ios'),
      ];

      let patchedAny = false;
      for (const basePath of possiblePaths) {
        if (!fs.existsSync(basePath)) continue;
        console.log(`🔧 Patching ${basePath}...`);

        // 1. getMimeType(from asset:) — PHAsset.contentType is iOS 26+
        patchedAny |= patchFile(
          path.join(basePath, 'MediaHandler.swift'),
          `  private func getMimeType(from asset: PHAsset?, fileExtension: String) -> String? {
    let utType: UTType? = if #available(iOS 26.0, *) {
      asset?.contentType ?? UTType(filenameExtension: fileExtension)
    } else {
      UTType(filenameExtension: fileExtension)
    }
    return utType?.preferredMIMEType
  }`,
          `  private func getMimeType(from asset: PHAsset?, fileExtension: String) -> String? {
    // [patched for iOS<26 SDK] PHAsset.contentType unavailable; fall back to filename extension only
    let utType: UTType? = UTType(filenameExtension: fileExtension)
    return utType?.preferredMIMEType
  }`,
          'MediaHandler.swift: getMimeType(from asset:) — strip PHAsset.contentType branch'
        );

        // 2. getMimeType(from resource:) — PHAssetResource.contentType is iOS 26+
        patchedAny |= patchFile(
          path.join(basePath, 'MediaHandler.swift'),
          `  private func getMimeType(from resource: PHAssetResource, fileExtension: String) -> String? {
    let utType: UTType? = if #available(iOS 26.0, *) {
      resource.contentType
    } else {
      UTType(resource.uniformTypeIdentifier) ?? UTType(filenameExtension: fileExtension)
    }
    return utType?.preferredMIMEType
  }`,
          `  private func getMimeType(from resource: PHAssetResource, fileExtension: String) -> String? {
    // [patched for iOS<26 SDK] PHAssetResource.contentType unavailable; fall back to UTI / filename extension
    let utType: UTType? = UTType(resource.uniformTypeIdentifier) ?? UTType(filenameExtension: fileExtension)
    return utType?.preferredMIMEType
  }`,
          'MediaHandler.swift: getMimeType(from resource:) — strip PHAssetResource.contentType branch'
        );
      }

      if (patchedAny) {
        console.log('✅ [patch-expo-image-picker] Patches applied successfully');
      } else {
        console.log('⚠️  [patch-expo-image-picker] No patches applied (already patched or string drift)');
      }

      return config;
    },
  ]);
};
