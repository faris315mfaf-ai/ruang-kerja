/**
 * Tanda tangan build rilis Android dari keystore upload milik pemilik.
 *
 * Saat `expo prebuild`, plugin ini menambah `signingConfigs.release` ke
 * `android/app/build.gradle`. Gradle membaca berkas properti yang ditunjuk
 * env `RUANGKERJA_KEYSTORE_PROPERTIES` (path absolut) **saat build**, bukan
 * saat prebuild — jadi tidak ada rahasia yang tertulis ke folder `android/`.
 *
 * Isi berkas properti (contoh, nilai sungguhan hanya di `secrets/android/`):
 *   storeFile=ruangkerja-upload.jks   # relatif terhadap folder berkas properti, atau absolut
 *   storePassword=…
 *   keyAlias=ruangkerja-upload
 *   keyPassword=…
 *
 * Env kosong → build rilis tetap jalan dengan kunci debug (developer lain/CI),
 * dengan peringatan di log. Env terisi tetapi berkas/kunci tidak lengkap →
 * build gagal (lebih baik gagal daripada mengunggah APK berkunci debug).
 * Panduan: docs/deploy/ANDROID-RILIS.md.
 */
const { withAppBuildGradle } = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const SETUP = `
// RuangKerja: kunci upload dibaca dari RUANGKERJA_KEYSTORE_PROPERTIES (docs/deploy/ANDROID-RILIS.md).
def rkKeystorePropsPath = System.getenv('RUANGKERJA_KEYSTORE_PROPERTIES')
def rkKeystoreProps = new Properties()
def rkKeystoreFile = null
if (rkKeystorePropsPath) {
    def rkPropsFile = new File(rkKeystorePropsPath)
    if (!rkPropsFile.isFile()) {
        throw new GradleException("RUANGKERJA_KEYSTORE_PROPERTIES menunjuk berkas yang tidak ada: \${rkKeystorePropsPath}")
    }
    rkPropsFile.withInputStream { rkKeystoreProps.load(it) }
    ['storeFile', 'storePassword', 'keyAlias', 'keyPassword'].each { kunci ->
        if (!rkKeystoreProps.getProperty(kunci)) {
            throw new GradleException("Berkas keystore.properties tidak memuat '\${kunci}'.")
        }
    }
    rkKeystoreFile = new File(rkKeystoreProps.getProperty('storeFile'))
    if (!rkKeystoreFile.isAbsolute()) {
        rkKeystoreFile = new File(rkPropsFile.parentFile, rkKeystoreProps.getProperty('storeFile'))
    }
    if (!rkKeystoreFile.isFile()) {
        throw new GradleException("Keystore tidak ditemukan: \${rkKeystoreFile}")
    }
} else {
    logger.warn('RuangKerja: RUANGKERJA_KEYSTORE_PROPERTIES kosong — build rilis ditandatangani kunci DEBUG (tidak bisa diunggah ke Play).')
}
`;

const SIGNING_CONFIG = `        release {
            if (rkKeystoreFile != null) {
                storeFile rkKeystoreFile
                storePassword rkKeystoreProps.getProperty('storePassword')
                keyAlias rkKeystoreProps.getProperty('keyAlias')
                keyPassword rkKeystoreProps.getProperty('keyPassword')
            }
        }`;

function tambahTandaTangan(src) {
  // 1) Pembacaan properti sebelum blok android { }.
  let hasil = mergeContents({
    tag: 'ruangkerja-release-signing-setup',
    src,
    newSrc: SETUP,
    anchor: /^android\s*\{/m,
    offset: 0,
    comment: '//',
  }).contents;

  // 2) signingConfigs.release di samping debug.
  hasil = mergeContents({
    tag: 'ruangkerja-release-signing-config',
    src: hasil,
    newSrc: SIGNING_CONFIG,
    anchor: /^\s*signingConfigs\s*\{/m,
    offset: 1,
    comment: '//',
  }).contents;

  // 3) buildTypes.release memakai kunci rilis bila tersedia (debug sebagai cadangan).
  const pola = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
  if (pola.test(hasil)) {
    hasil = hasil.replace(pola, '$1signingConfig rkKeystoreFile != null ? signingConfigs.release : signingConfigs.debug');
  } else if (!hasil.includes('rkKeystoreFile != null ? signingConfigs.release')) {
    throw new Error('withReleaseSigning: buildTypes.release.signingConfig tidak ditemukan di android/app/build.gradle (templat berubah?).');
  }
  return hasil;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withReleaseSigning: hanya mendukung build.gradle Groovy.');
    }
    cfg.modResults.contents = tambahTandaTangan(cfg.modResults.contents);
    return cfg;
  });
};
