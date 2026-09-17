// @ts-check

/**
 * @namespace Pde_Alex_Cli_Command_LegacyRuntimeMigration
 * @description Runs the explicit legacy Runtime DEM and environment migrations.
 */

const ENV_FILE = '.env';
const LEGACY_PREFIX = 'PDE_RUNTIME__TRUSTED_PERSON_SMTP_';
const CURRENT_PREFIX = 'PDE_RUNTIME__DELEGATE_SMTP_';

/**
 * @param {string} line
 * @returns {string|undefined}
 */
function optionNameOf(line) {
    return /^[ \t]*(?:export[ \t]+)?([A-Z][A-Z0-9_]*)[ \t]*=/.exec(line)?.[1];
}

/**
 * @param {object} deps
 * @param {any} deps.fs
 * @param {any} deps.path
 * @param {string} deps.applicationRoot
 * @returns {Promise<object>}
 */
async function migrateDotEnv({fs, path, applicationRoot}) {
    const filename = path.join(applicationRoot, ENV_FILE);
    let source;
    try {
        source = await fs.readFile(filename, 'utf8');
    } catch (error) {
        if (error?.code === 'ENOENT') return Object.freeze({status: 'missing', renamed: 0});
        throw error;
    }

    const legacyOptions = new Map();
    const currentOptions = new Set();
    for (const line of source.split(/\r?\n/)) {
        const name = optionNameOf(line);
        if (!name) continue;
        if (name.startsWith(LEGACY_PREFIX)) legacyOptions.set(name, (legacyOptions.get(name) ?? 0) + 1);
        else currentOptions.add(name);
    }
    if (legacyOptions.size === 0) return Object.freeze({status: 'unchanged', renamed: 0});

    for (const [legacy, count] of legacyOptions) {
        const current = CURRENT_PREFIX + legacy.slice(LEGACY_PREFIX.length);
        if (count > 1 || currentOptions.has(current)) {
            throw new Error(`Cannot migrate configuration option '${legacy}': target '${current}' already exists or is duplicated.`);
        }
    }

    const migrated = source.replace(/^([ \t]*(?:export[ \t]+)?)PDE_RUNTIME__TRUSTED_PERSON_SMTP_([A-Z0-9_]+)(?=[ \t]*=)/gm, `$1${CURRENT_PREFIX}$2`);
    const fileMode = (await fs.stat(filename)).mode & 0o777;
    const directory = path.dirname(filename);
    const temporary = path.join(directory, `.${ENV_FILE}.migration-${process.pid}-${Date.now()}`);
    try {
        await fs.writeFile(temporary, migrated, {encoding: 'utf8', mode: fileMode});
        await fs.chmod(temporary, fileMode);
        await fs.rename(temporary, filename);
    } finally {
        await fs.rm(temporary, {force: true}).catch(() => undefined);
    }
    return Object.freeze({status: 'migrated', renamed: legacyOptions.size});
}

/**
 * @param {object} deps
 * @param {Pde_Alex_Storage_LegacyRuntimeMigration} deps.migration
 * @param {TeqFw_Cli_Adapter_Io} deps.io
 * @param {TeqFw_Cli_Config} deps.cliConfig
 * @param {any} deps.fs
 * @param {any} deps.path
 * @returns {TeqFw_Cli_Dto_Command}
 */
export default function LegacyRuntimeMigration({migration, io, cliConfig, fs, path}) {
    return Object.freeze({id: 'db:migrate', summary: 'Rebuild the Runtime DEM from a recognized predecessor, remove source backups after verification, and migrate legacy Runtime options in .env.', lifetime: 'finite', execute: async function () {
        const result = await migration.execute();
        io.write(`Runtime DEM migration ${result.status}. Source backups removed: ${result.backups.length}.\n`);
        const env = await migrateDotEnv({fs, path, applicationRoot: cliConfig.applicationRoot});
        io.write(`Runtime .env migration ${env.status}. Configuration options renamed: ${env.renamed}.\n`);
    }});
}

export const __deps__ = Object.freeze({default: Object.freeze({
    migration: 'Pde_Alex_Storage_LegacyRuntimeMigration$', io: 'TeqFw_Cli_Adapter_Io$', cliConfig: 'TeqFw_Cli_Config$',
    fs: 'node:fs/promises', path: 'node:path',
})});
