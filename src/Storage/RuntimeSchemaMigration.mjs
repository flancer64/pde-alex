// @ts-check

/**
 * @namespace Pde_Alex_Storage_RuntimeSchemaMigration
 * @description Migrates one reviewed legacy Runtime PostgreSQL layout to the installed Runtime DEM layout.
 */

const TABLE = Object.freeze({
    accessToken: 'pde_runtime_access_token',
    auditEvent: 'pde_runtime_audit_event',
    delegation: 'pde_runtime_delegation',
});

const PRIMARY_KEY = Object.freeze({
    [TABLE.accessToken]: 'digest',
    [TABLE.auditEvent]: 'id',
    [TABLE.delegation]: 'id',
});

const LEGACY_COLUMNS = Object.freeze({
    [TABLE.accessToken]: Object.freeze(['client_id', 'digest', 'expires_at', 'issued_at', 'resource', 'scopes_json']),
    [TABLE.auditEvent]: Object.freeze(['capability_id', 'client_id', 'decision', 'delegation_id', 'event_type', 'id', 'occurred_at', 'reason', 'resource']),
    [TABLE.delegation]: Object.freeze(['capability_id', 'client_id', 'created_at', 'id', 'resource', 'resource_connection_id', 'revoked_at']),
});

const TARGET_COLUMNS = Object.freeze({
    [TABLE.accessToken]: Object.freeze(['client_id', 'digest', 'expires_at', 'issued_at', 'protected_endpoint', 'scopes_json']),
    [TABLE.auditEvent]: Object.freeze(['capability_id', 'client_id', 'decision', 'delegation_id', 'event_type', 'id', 'occurred_at', 'operation_id', 'reason']),
    [TABLE.delegation]: Object.freeze(['capability_id', 'client_id', 'created_at', 'id', 'permission_json', 'revoked_at']),
});

const ARCHIVE_SUFFIX = '_legacy_v1';
const ECHO_CAPABILITY = 'pde.echo';

/**
 * @param {readonly string[]} actual
 * @param {readonly string[]} expected
 * @returns {boolean}
 */
function sameColumns(actual, expected) {
    return actual.length === expected.length && actual.every((name) => expected.includes(name));
}

/**
 * @param {object} deps
 * @param {TeqFw_Db_Back_Config} deps.config
 * @param {TeqFw_Db_Back_RDb_Connect} deps.connection
 */
export default class RuntimeSchemaMigration {
    /**
     * @param {object} deps
     * @param {TeqFw_Db_Back_Config} deps.config
     * @param {TeqFw_Db_Back_RDb_Connect} deps.connection
     */
    constructor({config, connection}) {
        /** @returns {Promise<object>} */
        this.execute = async function () {
            const dbConfig = config.get();
            if (dbConfig.client !== 'pg') throw new Error('This Runtime schema migration supports PostgreSQL only.');

            const startedConnection = !connection.getClient();
            if (startedConnection) await connection.init(dbConfig);
            try {
                const client = connection.getClient();
                if (!client) throw new Error('Configured database connection is unavailable.');

                const columnsByTable = await readColumns(client);
                const states = Object.values(TABLE).map((table) => ({
                    table,
                    columns: columnsByTable.get(table) ?? [],
                }));
                const upToDate = states.every(({table, columns}) => sameColumns(columns, TARGET_COLUMNS[table]));
                if (upToDate) return Object.freeze({status: 'up-to-date', archivedRows: 0});
                const recognizedLegacy = states.every(({table, columns}) => sameColumns(columns, LEGACY_COLUMNS[table]));
                if (!recognizedLegacy) {
                    throw new Error('Database schema is neither the expected Runtime schema nor the reviewed legacy layout; no changes were made.');
                }

                const auditTooLong = await client(TABLE.auditEvent).whereRaw('char_length(resource) > 255').count({count: '*'}).first();
                if (Number(auditTooLong?.count ?? 0) > 0) {
                    throw new Error('Legacy audit resource values exceed the target operation_id length; no conversion was inferred.');
                }
                const unsupportedDelegations = await client(TABLE.delegation).whereNot('capability_id', ECHO_CAPABILITY).count({count: '*'}).first();
                if (Number(unsupportedDelegations?.count ?? 0) > 0) {
                    throw new Error('Legacy Delegations contain capabilities without an explicit Permission conversion; no changes were made.');
                }

                return await client.transaction(async (transaction) => {
                    let archivedRows = 0;
                    for (const table of Object.values(TABLE)) archivedRows += await archiveRows(transaction, table);

                    await transaction.raw('ALTER TABLE ?? RENAME COLUMN ?? TO ??', [TABLE.accessToken, 'resource', 'protected_endpoint']);
                    await transaction.raw('ALTER TABLE ?? RENAME COLUMN ?? TO ??', [TABLE.auditEvent, 'resource', 'operation_id']);
                    await transaction.raw('ALTER TABLE ?? ALTER COLUMN ?? TYPE varchar(255) USING ??::varchar(255)', [TABLE.auditEvent, 'operation_id', 'operation_id']);

                    const delegationIndex = `${TABLE.delegation}_activelookup`;
                    await transaction.raw('DROP INDEX IF EXISTS ??', [delegationIndex]);
                    await transaction.raw('ALTER TABLE ?? ADD COLUMN ?? text', [TABLE.delegation, 'permission_json']);
                    await transaction(TABLE.delegation).update({permission_json: JSON.stringify({})});
                    await transaction.raw('ALTER TABLE ?? ALTER COLUMN ?? SET NOT NULL', [TABLE.delegation, 'permission_json']);
                    await transaction.raw('ALTER TABLE ?? DROP COLUMN ??, DROP COLUMN ??', [TABLE.delegation, 'resource', 'resource_connection_id']);
                    await transaction.raw('CREATE INDEX ?? ON ?? (??, ??)', [delegationIndex, TABLE.delegation, 'client_id', 'capability_id']);

                    return Object.freeze({status: 'migrated', archivedRows});
                });
            } finally {
                if (startedConnection) await connection.disconnect();
            }
        };
        Object.freeze(this);
    }
}

/**
 * @param {any} client
 * @returns {Promise<object>}
 */
async function readColumns(client) {
    const result = await client('information_schema.columns')
        .select('table_name', 'column_name')
        .where('table_schema', 'public')
        .whereIn('table_name', Object.values(TABLE))
        .orderBy('table_name')
        .orderBy('ordinal_position');
    const columns = new Map();
    for (const row of result) {
        const names = columns.get(row.table_name) ?? [];
        names.push(row.column_name);
        columns.set(row.table_name, names);
    }
    return columns;
}

/**
 * @param {any} transaction
 * @param {string} sourceTable
 * @returns {Promise<number>}
 */
async function archiveRows(transaction, sourceTable) {
    const archiveTable = `${sourceTable}${ARCHIVE_SUFFIX}`;
    const primaryKey = PRIMARY_KEY[sourceTable];
    if (!primaryKey) throw new Error(`No archive identity is declared for '${sourceTable}'.`);
    await transaction.raw('CREATE TABLE IF NOT EXISTS ?? (source_id varchar(128) PRIMARY KEY, archived_at timestamptz NOT NULL, row_data jsonb NOT NULL)', [archiveTable]);
    const result = await transaction.raw('INSERT INTO ?? (source_id, archived_at, row_data) SELECT ??, CURRENT_TIMESTAMP, to_jsonb(source_row) FROM ?? AS source_row ON CONFLICT (source_id) DO NOTHING', [archiveTable, primaryKey, sourceTable]);
    return Number(result.rowCount ?? 0);
}

export const __deps__ = Object.freeze({
    default: Object.freeze({
        config: 'TeqFw_Db_Back_Config$',
        connection: 'TeqFw_Db_Back_RDb_Connect$',
    }),
});
