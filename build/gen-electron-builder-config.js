//@ts-check
import { writeFileSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import { isAppxSupportedLanguage } from './appx_languages.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const exclude_list = readFileSync(
  join(__dirname, 'packageignore_list'),
  'utf-8'
)
  .split('\n')
  .map(line => line.trim())
  .filter(line => line != '' && !line.startsWith('#'))
  .map(line => '!' + line)
const files = [
  // start with including all files
  '**/*',
  ...exclude_list,
]
const env = process.env

/** @type {import('./types').DeepWriteable<import('electron-builder').Configuration>} */
const build = {}
build['appId'] = 'chat.delta.desktop.electron'
build['protocols'] = [
  {
    name: 'QR code data',
    role: 'Viewer',
    schemes: ['openpgp4fpr', 'dcaccount', 'dclogin'],
  },
  {
    name: 'Send Mails via MailTo Scheme',
    // https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/Articles/CoreFoundationKeys.html#//apple_ref/doc/uid/TP40009249-102207-TPXREF115
    role: 'Viewer',
    schemes: ['mailto'],
  },
]

build['fileAssociations'] = [
  {
    ext: 'xdc',
    name: 'Webxdc app',
    // icon - default, which means build/ext\.(ico|icns)
    mimeType: 'application/x-webxdc',
  },
]

build['files'] = files
build['asarUnpack'] = []
// 'html-dist/xdcs/' should be in 'asarUnpack', but that had "file already exists" errors in the ci
// see https://github.com/deltachat/deltachat-desktop/pull/3876, so we now do it "manually" in the afterPackHook

build['afterPack'] = './build/afterPackHook.cjs'
build['afterSign'] = './build/afterSignHook.cjs'

if (typeof env.NO_ASAR !== 'undefined' && env.NO_ASAR != 'false') {
  build['asar'] = false
}

// platform specific

const PREBUILD_FILTERS = {
  NOT_LINUX: '!node_modules/@deltachat/stdio-rpc-server-linux-*${/*}',
  NOT_MAC: '!node_modules/@deltachat/stdio-rpc-server-darwin-*${/*}',
  NOT_WINDOWS: '!node_modules/@deltachat/stdio-rpc-server-win32-*${/*}',
}

build['mac'] = {
  appId: 'chat.delta.desktop.electron',
  category: 'public.app-category.social-networking',
  entitlements: 'build/entitlements.mac.plist',
  entitlementsInherit: 'build/entitlements.mac.plist',
  extendInfo: {
    NSCameraUsageDescription: 'For scanning qr codes.',
    // NSMicrophoneUsageDescription: "For voice messages",
    ITSAppUsesNonExemptEncryption: false,
  },
  gatekeeperAssess: true,
  hardenedRuntime: true,
  icon: 'resources/icon.icns',
  provisioningProfile: './../embedded.provisionprofile',
  files: [...files, PREBUILD_FILTERS.NOT_LINUX, PREBUILD_FILTERS.NOT_WINDOWS],
  darkModeSupport: true,
}

build['mas'] = {
  hardenedRuntime: false,
  entitlements: 'build/entitlements.mas.plist',
  entitlementsInherit: 'build/entitlements.mas.inherit.plist',
  // binaries // Paths of any extra binaries that need to be signed.
}

build['dmg'] = {
  sign: false,
  contents: [
    {
      x: 220,
      y: 200,
    },
    {
      x: 448,
      y: 200,
      type: 'link',
      path: '/Applications',
    },
  ],
}
build['linux'] = {
  target: ['AppImage', 'deb'],
  category: 'Network;Chat;InstantMessaging;',
  desktop: {
    Comment: 'Delta Chat email-based messenger',
    Keywords: 'dc;chat;delta;messaging;messenger;email',
  },
  files: [...files, PREBUILD_FILTERS.NOT_MAC, PREBUILD_FILTERS.NOT_WINDOWS],
  icon: 'build/icon.icns', // electron builder gets the icon out of the mac icon archive
  description: 'The Email messenger (https://delta.chat)',
}
build['win'] = {
  icon: 'images/deltachat.ico',
  files: [...files, PREBUILD_FILTERS.NOT_MAC, PREBUILD_FILTERS.NOT_LINUX],
}

// supported languages are on https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/supported-languages?pivots=store-installer-msix
const languages = [
  'ar',
  'bg',
  'ca',
  'cs',
  // 'ckb', not supported by ms-store
  'da',
  'de',
  'en',
  'el',
  // 'eo',  not supported by ms-store
  'es',
  'eu',
  'fa',
  'fi',
  'fr',
  'gl',
  'hr',
  'hu',
  'id',
  'it',
  'ja-jp',
  'km',
  'ko',
  'lt',
  'nb',
  'nl-nl',
  'pl',
  'pt',
  'pt-BR',
  'ro',
  'ru',
  // 'sc', not supported by ms-store
  'sk',
  'sq',
  // sr', not supported by ms-store - although ms page mentions it as supported
  'sv',
  'ta',
  'te',
  'tr',
  'uk',
  'vi',
  'zh-cn',
  'zh-tw',
].map(code => code.toLowerCase())

const unsupported_languages = languages.filter(
  code => !isAppxSupportedLanguage(code)
)
if (unsupported_languages.length > 0) {
  throw new Error(
    'Unsupported appx languages:' + JSON.stringify(unsupported_languages)
  )
}

build['appx'] = {
  applicationId: build['appId'],
  publisher: 'CN=C13753E5-D590-467C-9FCA-6799E1A5EC1E',
  publisherDisplayName: 'merlinux',
  identityName: 'merlinux.DeltaChat',
  languages,
}

// see https://www.electron.build/configuration/nsis
build['nsis'] = {
  oneClick: false,
  allowToChangeInstallationDirectory: false,
}

// module.exports = build
// using this as a js module doesn#t work on windows
// because electron builder asks windows to open it as file instead of reading it.

writeFileSync(
  join(__dirname, '../electron-builder.json5'),
  '// GENERATED, this file is generated by gen-electron-builder-config.js \n// run "pack:generate_config" to re-generate it\n' +
    JSON.stringify(build)
)
