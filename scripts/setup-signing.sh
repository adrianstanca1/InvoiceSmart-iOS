#!/bin/bash
set -e

KEYCHAIN_PASSWORD="invoicesmart-ci"
KEYCHAIN_PATH="$RUNNER_TEMP/invoicesmart.keychain"

# Create keychain
security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security list-keychains -d user -s "$KEYCHAIN_PATH" $(security list-keychains -d user | sed 's/.*"\(.*\)".*/\1/')
security default-keychain -s "$KEYCHAIN_PATH"

# Download Apple WWDR intermediate certificates (required for code signing chain)
echo "=== Installing Apple WWDR intermediate certificates ==="
curl -sSL -o /tmp/AppleWWDRCA.cer https://www.apple.com/certificateauthority/AppleWWDRCA.cer || true
curl -sSL -o /tmp/AppleWWDRCAG3.cer https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer || true
curl -sSL -o /tmp/AppleWWDRCAG4.cer https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer || true

for cert in /tmp/AppleWWDRCA.cer /tmp/AppleWWDRCAG3.cer /tmp/AppleWWDRCAG4.cer; do
  if [ -f "$cert" ]; then
    security import "$cert" -k "$KEYCHAIN_PATH" -T /usr/bin/codesign -T /usr/bin/security || true
    echo "Imported $(basename $cert)"
  fi
done

# Write cert and key from environment variables
python3 << 'PYEOF'
import base64, os, subprocess, plistlib, datetime, hashlib

cert_b64 = os.environ.get('IOS_DISTRIBUTION_CERT', '')
key_b64 = os.environ.get('IOS_DISTRIBUTION_KEY', '')
prov_b64 = os.environ.get('IOS_PROVISIONING_PROFILE', '')

with open('/tmp/distribution.cer', 'wb') as f:
    f.write(base64.b64decode(cert_b64))
    
with open('/tmp/distribution.key', 'wb') as f:
    f.write(base64.b64decode(key_b64))
    
with open('/tmp/invoicesmart.mobileprovision', 'wb') as f:
    f.write(base64.b64decode(prov_b64))
    
# Extract UUID and name from provisioning profile
with open('/tmp/invoicesmart.mobileprovision', 'rb') as f:
    data = f.read()
start = data.find(b'\x3c\x3f\x78\x6d\x6c')
end = data.rfind(b'\x3c\x2f\x70\x6c\x69\x73\x74\x3e') + 8
plist_data = data[start:end]
pl = plistlib.loads(plist_data)

uuid = pl.get('UUID', '')
name = pl.get('Name', 'InvoiceSmart')
app_id = pl.get('AppIDName', '')
team_id = pl.get('TeamIdentifier', [''])[0]
expiry = pl.get('ExpirationDate', None)

print(f"Profile Name: {name}")
print(f"Profile UUID: {uuid}")
print(f"App ID: {app_id}")
print(f"Team ID: {team_id}")
if expiry:
    now = datetime.datetime.utcnow()
    if expiry.tzinfo is not None:
        now = datetime.datetime.now(datetime.timezone.utc)
    print(f"Profile Expires: {expiry} ({'EXPIRED' if expiry < now else 'Valid'})")

with open('/tmp/profile_uuid.txt', 'w') as f:
    f.write(uuid)
with open('/tmp/profile_name.txt', 'w') as f:
    f.write(name)

# Verify cert thumbprint and expiration
certs = pl.get('DeveloperCertificates', [])
print(f"Number of certs in profile: {len(certs)}")
for i, cert_der in enumerate(certs):
    sha1 = hashlib.sha1(cert_der).hexdigest()
    print(f"Cert {i}: {len(cert_der)} bytes, SHA1={sha1}")

# Also check the imported cert file
result = subprocess.run(['openssl', 'x509', '-in', '/tmp/distribution.cer', '-inform', 'DER', '-noout', '-dates', '-subject', '-issuer', '-fingerprint'], capture_output=True, text=True)
print("=== Imported cert details ===")
print(result.stdout)
if result.stderr:
    print(result.stderr)

print(f"Cert file: {os.path.getsize('/tmp/distribution.cer')} bytes")
print(f"Key file: {os.path.getsize('/tmp/distribution.key')} bytes")
print(f"Prov file: {os.path.getsize('/tmp/invoicesmart.mobileprovision')} bytes")
PYEOF

UUID=$(cat /tmp/profile_uuid.txt)
NAME=$(cat /tmp/profile_name.txt)
echo "Using profile UUID: $UUID, Name: $NAME"

# Convert DER cert to PEM
openssl x509 -inform DER -in /tmp/distribution.cer -out /tmp/distribution.pem

# Combine into P12
openssl pkcs12 -export -in /tmp/distribution.pem -inkey /tmp/distribution.key \
  -out /tmp/distribution.p12 -name "InvoiceSmart Distribution" \
  -passout pass:invoicesmart123

# Import P12 into keychain
security import /tmp/distribution.p12 -P "invoicesmart123" -k "$KEYCHAIN_PATH" -T /usr/bin/codesign -T /usr/bin/security
security set-key-partition-list -S apple-tool:,apple: -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"

# Install provisioning profile in ALL possible locations
PROV_DIR="$HOME/Library/MobileDevice/Provisioning Profiles"
mkdir -p "$PROV_DIR"

# Install with UUID filename (Xcode preferred)
cp /tmp/invoicesmart.mobileprovision "$PROV_DIR/${UUID}.mobileprovision"

# Also install with name filename
cp /tmp/invoicesmart.mobileprovision "$PROV_DIR/${NAME}.mobileprovision"

# Also install as generic name
cp /tmp/invoicesmart.mobileprovision "$PROV_DIR/invoicesmart_app_store.mobileprovision"

echo "=== Installed profiles ==="
ls -la "$PROV_DIR/"

echo "=== Keychain certificates (detailed) ==="
security find-identity -v -p codesigning "$KEYCHAIN_PATH"

echo "=== Verify cert chain ==="
security verify-cert -c "$KEYCHAIN_PATH" -p codeSign 2>/dev/null || true

echo "=== Default keychain certificates ==="
security find-identity -v -p codesigning || true

# Export profile info to GITHUB_ENV for downstream steps
if [ -n "${GITHUB_ENV:-}" ]; then
  echo "PROFILE_UUID=$UUID" >> "$GITHUB_ENV"
  echo "PROFILE_NAME=$NAME" >> "$GITHUB_ENV"
  echo "KEYCHAIN_PATH=$KEYCHAIN_PATH" >> "$GITHUB_ENV"
fi

# Clean up sensitive temp files (keep GITHUB_ENV references)
rm -f /tmp/distribution.cer /tmp/distribution.key /tmp/distribution.pem /tmp/distribution.p12 /tmp/invoicesmart.mobileprovision /tmp/profile_uuid.txt /tmp/profile_name.txt /tmp/AppleWWDRCA.cer /tmp/AppleWWDRCAG3.cer /tmp/AppleWWDRCAG4.cer
