// Firma del pase de Apple: firma PKCS#7 "detached" de manifest.json con el certificado
// del Pass Type ID, incluyendo el certificado intermedio WWDR de Apple.
// Necesita los secrets APPLE_PASS_CERT_PEM, APPLE_PASS_KEY_PEM y APPLE_WWDR_PEM
// (docs/WALLET.md). Se importa solo cuando Apple está configurado.
// @deno-types="@types/node-forge"
import forge from 'node-forge'
import type { AppleConfig } from '../lib/config.ts'

function toBinaryString(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += String.fromCharCode(b)
  return out
}

function fromBinaryString(value: string): Uint8Array {
  const out = new Uint8Array(value.length)
  for (let i = 0; i < value.length; i++) out[i] = value.charCodeAt(i)
  return out
}

export function signManifest(
  manifest: Uint8Array,
  credentials: Pick<AppleConfig, 'certPem' | 'keyPem' | 'keyPassphrase' | 'wwdrPem'>,
  signingTime: Date = new Date(),
): Uint8Array {
  const certificate = forge.pki.certificateFromPem(credentials.certPem)
  const wwdr = forge.pki.certificateFromPem(credentials.wwdrPem)
  const key = credentials.keyPassphrase
    ? forge.pki.decryptRsaPrivateKey(credentials.keyPem, credentials.keyPassphrase)
    : forge.pki.privateKeyFromPem(credentials.keyPem)
  if (!key) throw new Error('APPLE_PASS_KEY_PEM could not be read (wrong passphrase?)')

  const p7 = forge.pkcs7.createSignedData()
  p7.content = forge.util.createBuffer(toBinaryString(manifest))
  p7.addCertificate(certificate)
  p7.addCertificate(wwdr)
  p7.addSigner({
    key,
    certificate,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: signingTime.toISOString() },
    ],
  })
  p7.sign({ detached: true })
  return fromBinaryString(forge.asn1.toDer(p7.toAsn1()).getBytes())
}
