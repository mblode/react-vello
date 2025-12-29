const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..')
const pkgDir = path.join(repoRoot, 'crates', 'rvello', 'pkg')
const packageWasmDir = path.join(repoRoot, 'packages', 'react-vello', 'src', 'wasm')
const artifacts = [
  path.join(repoRoot, 'crates', 'rvello', 'pkg', 'rvello.js'),
  path.join(repoRoot, 'crates', 'rvello', 'pkg', 'rvello_bg.wasm'),
]
const packageArtifacts = [
  { src: path.join(pkgDir, 'rvello.js'), dest: path.join(packageWasmDir, 'rvello.js') },
  { src: path.join(pkgDir, 'rvello_bg.wasm'), dest: path.join(packageWasmDir, 'rvello_bg.wasm') },
  { src: path.join(pkgDir, 'rvello.d.ts'), dest: path.join(packageWasmDir, 'rvello.d.ts') },
  { src: path.join(pkgDir, 'rvello_bg.wasm.d.ts'), dest: path.join(packageWasmDir, 'rvello_bg.wasm.d.ts') },
]
const pkgGitignorePath = path.join(pkgDir, '.gitignore')
const pkgGitignoreContents = [
  '*',
  '!.gitignore',
  '!package.json',
  '!rvello.js',
  '!rvello.d.ts',
  '!rvello_bg.wasm',
  '!rvello_bg.wasm.d.ts',
  '',
].join('\n')

const ensurePkgGitignore = () => {
  if (!fs.existsSync(pkgDir)) {
    return
  }

  const current = fs.existsSync(pkgGitignorePath)
    ? fs.readFileSync(pkgGitignorePath, 'utf8')
    : ''

  if (current !== pkgGitignoreContents) {
    fs.writeFileSync(pkgGitignorePath, pkgGitignoreContents, 'utf8')
  }
}

const syncPackageWasm = () => {
  if (!fs.existsSync(pkgDir)) {
    return
  }

  fs.mkdirSync(packageWasmDir, { recursive: true })
  for (const { src, dest } of packageArtifacts) {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest)
    }
  }
}

const missing = artifacts.filter((file) => !fs.existsSync(file))

if (missing.length === 0) {
  ensurePkgGitignore()
  syncPackageWasm()
  process.exit(0)
}

const missingList = missing
  .map((file) => `- ${path.relative(repoRoot, file)}`)
  .join('\n')

if (process.env.VERCEL) {
  console.error(
    `[rvello] Missing wasm artifacts:\n${missingList}\n` +
      '[rvello] Run "pnpm -w wasm:build" locally and commit crates/rvello/pkg.'
  )
  process.exit(1)
}

console.log(`[rvello] Missing wasm artifacts:\n${missingList}`)
console.log('[rvello] Building wasm bridge via wasm-pack...')
execSync('pnpm -w wasm:build', { cwd: repoRoot, stdio: 'inherit' })
ensurePkgGitignore()
syncPackageWasm()
