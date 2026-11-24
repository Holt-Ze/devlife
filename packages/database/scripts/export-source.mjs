import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

// Uses the repository's existing TypeScript compiler; no runtime changes to source files.
const sourceRoot = fileURLToPath(new URL('../../data/src/', import.meta.url))
const buildRoot = fileURLToPath(new URL('../../../.local/source-export/', import.meta.url))
const visited = new Set()
async function compile(file) {
    if (visited.has(file)) return
    visited.add(file)
    const input = await readFile(file, 'utf8')
    const result = ts.transpileModule(input, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: false } })
    const output = result.outputText.replace(/(from\s*['"]|import\s*['"])(\.[^'"]+)(['"])/g, (_, a, b, c) => a + b.replace(/\.ts$/, '') + '.mjs' + c)
    const target = path.join(buildRoot, path.relative(sourceRoot, file)).replace(/\.ts$/, '.mjs')
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, output)
    for (const dependency of ts.preProcessFile(input).importedFiles) {
        if (!dependency.fileName.startsWith('.')) continue
        const base = path.resolve(path.dirname(file), dependency.fileName)
        const candidate = base.endsWith('.ts') ? base : base + '.ts'
        if (await access(candidate).then(() => true, () => false)) await compile(candidate)
    }
}
await compile(path.join(sourceRoot, 'index.ts'))
const { events, talents, achievements, characters, ages, endings, CareerQuarters, CampusQuarters, majors, specialThanks } = await import(pathToFileURL(path.join(buildRoot, 'index.mjs')))
const result = {
    formatVersion: 2,
    source: 'game36',
    careerQuarters: CareerQuarters,
    campusQuarters: CampusQuarters,
    majors: [...majors.values()],
    events: [...events.values()],
    talents: [...talents.values()],
    achievements: [...achievements.values()],
    characters: [...characters.values()],
    ages: [...ages.values()],
    endings: [...endings].map(([event, definition]) => ({ event, ...definition })),
    specialThanks,
}
const dataDir = fileURLToPath(new URL('../data/', import.meta.url))
await mkdir(dataDir, { recursive: true })
await writeFile(path.join(dataDir, 'game36-source.json'), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({
    careerQuarters: CareerQuarters,
    campusQuarters: CampusQuarters,
    majors: majors.size,
    events: events.size,
    choices: result.events.reduce((n, item) => n + (item.choices?.length || 0), 0),
    talents: talents.size,
    achievements: achievements.size,
    characters: characters.size,
    endings: endings.size,
}))
