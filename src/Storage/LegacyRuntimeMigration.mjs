// @ts-check

/**
 * @namespace Pde_Alex_Storage_LegacyRuntimeMigration
 * @description Migrates the reviewed pre-Dynamic-Client-Registration Runtime schema.
 */
const SOURCE = Object.freeze({
    accessToken: 'pde_runtime_access_token',
    audit: 'pde_runtime_audit_event',
    delegation: 'pde_runtime_delegation',
    oauthClient: 'pde_runtime_oauth_client',
    ownerSession: 'pde_runtime_owner_session',
});
const SUFFIX = '__legacy_backup';
const COLUMNS = Object.freeze({
    accessToken: ['client_id', 'digest', 'expires_at', 'issued_at', 'resource', 'scopes_json'],
    audit: ['capability_id', 'client_id', 'decision', 'delegation_id', 'event_type', 'id', 'occurred_at', 'reason', 'resource'],
    delegation: ['capability_id', 'client_id', 'created_at', 'id', 'resource', 'resource_connection_id', 'revoked_at'],
    oauthClient: ['client_id', 'client_name', 'redirect_uris_json', 'registered_at'],
    ownerSession: ['csrf_token', 'digest', 'expires_at', 'issued_at'],
});
const TARGET_COLUMNS = Object.freeze({
    accessToken: ['client_id', 'digest', 'expires_at', 'issued_at', 'protected_endpoint', 'scopes_json'],
    refreshToken: ['client_id', 'digest', 'expires_at', 'issued_at', 'protected_endpoint', 'scopes_json'],
    oauthPolicy: ['access_token_ttl_seconds', 'client_id', 'updated_at'],
    snapshot: ['created_at', 'dem', 'fingerprint', 'id', 'provenance'],
    application: ['completed_at', 'id', 'source_snapshot_id', 'started_at', 'status', 'target_snapshot_id'],
    audit: ['capability_id', 'client_id', 'decision', 'delegation_id', 'event_type', 'id', 'occurred_at', 'operation_id', 'reason'],
    delegation: ['authorization_revision', 'capability_id', 'client_id', 'created_at', 'id', 'permission_json', 'revoked_at'],
    oauthClient: COLUMNS.oauthClient,
    ownerSession: COLUMNS.ownerSession,
    client: ['client_id', 'connected_at', 'disconnected_at', 'last_activity_at'],
});

export default class LegacyRuntimeMigration {
    /** @param {object} deps @param {TeqFw_Db_Back_Config} deps.config @param {TeqFw_Db_Back_RDb_Connect} deps.connection @param {TeqFw_Db_Back_Dem_Compile} deps.compile @param {TeqFw_Db_Back_RDb_Schema} deps.schema @param {Pde_Runtime_Storage_Schema} deps.schemaProvider */
    constructor({config, connection, compile, schema, schemaProvider}) {
        /** @returns {Promise<object>} */
        this.execute = async function () {
            const owned = !connection.getClient();
            if (owned) await connection.init(config.get());
            try {
                await connection.getClient().raw('SET search_path TO public');
                connection.setSchemaConfig({prefix: ''});
                const {readFileSync} = await import('node:fs');
                const {join} = await import('node:path');
                const dbSchemaPath = join(import.meta.dirname, '../../node_modules/@teqfw/db/etc/teqfw.schema.json');
                const dbDeclaration = Object.freeze(JSON.parse(readFileSync(dbSchemaPath, 'utf8')));
                const dbFragment = {declaration: dbDeclaration, filename: dbSchemaPath, fragmentId: 'teqfw.db.schema', packageName: 'teqfw.db.schema'};
                const compilation = compile.assertResult({value: await compile.exec({adapter: connection.getDialectAdapter(), fragments: [schemaProvider.getFragmentEnvelope(), dbFragment], mapEnvelope: schemaProvider.getMapEnvelope()})});
                schema.setCompilation({compilation});
                const byEntity = new Map(compilation.physical.tables.map((table) => [table.entity, table.name]));
                const target = Object.freeze({
                    accessToken: byEntity.get('/pde/runtime/oauth/token/access'), audit: byEntity.get('/pde/runtime/audit/event'),
                    refreshToken: byEntity.get('/pde/runtime/oauth/token/refresh'),
                    oauthPolicy: byEntity.get('/pde/runtime/oauth/policy'),
                    snapshot: byEntity.get('/teqfw/db/schema/snapshot'), application: byEntity.get('/teqfw/db/schema/application'),
                    delegation: byEntity.get('/pde/runtime/delegation'), oauthClient: byEntity.get('/pde/runtime/oauth/client'),
                    client: byEntity.get('/pde/runtime/client'), ownerSession: byEntity.get('/pde/runtime/person/session'),
                });
                if (Object.values(target).some((name) => !name)) throw new Error('Compiled Runtime DEM is incomplete.');
                const db = connection.getClient();
                const builder = connection.getSchemaBuilder();
                /** @param {string} name @returns {Promise<boolean>} */
                const hasPublicTable = async (name) => Boolean(await db('information_schema.tables').select('table_name').where({table_schema: 'public', table_name: name}).first());
                const targetState = new Map();
                for (const [key, name] of Object.entries(target)) {
                    if (!(await hasPublicTable(name))) { targetState.set(key, 'missing'); continue; }
                    const columns = await db('information_schema.columns').select('column_name').where({table_schema: 'public', table_name: name});
                    const names = columns.map((row) => row.column_name);
                    targetState.set(key, names.length === TARGET_COLUMNS[key].length && TARGET_COLUMNS[key].every((column) => names.includes(column)) ? 'target' : 'legacy');
                }
                const runtimeReady = [...targetState.entries()].filter(([key]) => key !== 'refreshToken' && key !== 'oauthPolicy').every(([, state]) => state === 'target');
                if (runtimeReady && await hasPublicTable(target.refreshToken) && await hasPublicTable(target.oauthPolicy) && await hasPublicTable(target.snapshot) && await hasPublicTable(target.application) && await db(target.application).where({status: 'applied'}).first()) {
                    for (const [key, name] of Object.entries(SOURCE)) if (await hasPublicTable(`${name}${SUFFIX}`)) {
                        const sourceCount = Number((await db(`${name}${SUFFIX}`).count({count: '*'}).first())?.count ?? 0);
                        const targetCount = Number((await db(target[key]).count({count: '*'}).first())?.count ?? 0);
                        if (sourceCount !== targetCount) throw new Error(`Migration verification failed for '${key}': source=${sourceCount}, target=${targetCount}. Backup tables were retained.`);
                        await db.raw('DROP TABLE ??', [`public.${name}${SUFFIX}`]);
                    }
                    return Object.freeze({status: 'up-to-date', backups: []});
                }
                if (runtimeReady) {
                    if (!(await hasPublicTable(target.refreshToken))) await db.schema.createTable(target.refreshToken, (table) => { table.string('client_id', 2048).notNullable(); table.string('digest', 128).notNullable(); table.timestamp('expires_at', {useTz: true, precision: 3}).notNullable(); table.timestamp('issued_at', {useTz: true, precision: 3}).notNullable(); table.string('protected_endpoint', 2048).notNullable(); table.text('scopes_json').notNullable(); table.primary(['digest'], {constraintName: `${target.refreshToken}_pk`}); });
                    if (!(await hasPublicTable(target.oauthPolicy))) await db.schema.createTable(target.oauthPolicy, (table) => { table.integer('access_token_ttl_seconds'); table.string('client_id', 2048).notNullable(); table.timestamp('updated_at', {useTz: true, precision: 3}).notNullable(); table.primary(['client_id'], {constraintName: `${target.oauthPolicy}_pk`}); });
                    const effective = compilation.effective;
                    await db(target.snapshot).insert({dem: JSON.stringify(effective.model), fingerprint: effective.fingerprint, provenance: JSON.stringify(effective.provenance)}).onConflict('fingerprint').ignore();
                    const snapshot = await db(target.snapshot).where({fingerprint: effective.fingerprint}).first();
                    if (!(await db(target.application).where({status: 'applied', target_snapshot_id: snapshot.id}).first())) await db(target.application).insert({status: 'applied', source_snapshot_id: null, target_snapshot_id: snapshot.id, completed_at: new Date().toISOString()});
                    return Object.freeze({status: 'migrated', backups: []});
                }
                const backups = Object.values(SOURCE).map((name) => `${name}${SUFFIX}`);
                const present = await Promise.all(Object.entries(SOURCE).map(async ([key, name]) => await hasPublicTable(name) || await hasPublicTable(`${name}${SUFFIX}`)));
                if (!present.every(Boolean)) throw new Error('Database is not the recognized pre-Dynamic-Client-Registration Runtime schema; no changes were made.');
                const catalog = await db('information_schema.columns').select('table_name', 'column_name').where({table_schema: 'public'}).whereIn('table_name', Object.values(SOURCE));
                const actual = new Map();
                for (const row of catalog) actual.set(row.table_name, [...(actual.get(row.table_name) ?? []), row.column_name]);
                for (const [key, name] of Object.entries(SOURCE)) {
                    const sourceName = await hasPublicTable(`${name}${SUFFIX}`) ? `${name}${SUFFIX}` : name;
                    const columns = sourceName.endsWith(SUFFIX) ? (await db('information_schema.columns').select('column_name').where({table_schema: 'public', table_name: sourceName})).map((row) => row.column_name) : actual.get(name) ?? [];
                    if (columns.length !== COLUMNS[key].length || COLUMNS[key].some((column) => !columns.includes(column))) throw new Error(`Table '${sourceName}' for '${key}' does not match the reviewed legacy schema; no changes were made.`);
                }
                for (const [key, name] of Object.entries(SOURCE)) if (await hasPublicTable(name) && !(await hasPublicTable(`${name}${SUFFIX}`))) await db.raw('ALTER TABLE ?? RENAME TO ??', [`public.${name}`, `${name}${SUFFIX}`]);
                for (const [key, name] of Object.entries(SOURCE)) if (await hasPublicTable(`${name}${SUFFIX}`)) {
                    const constraint = await db('pg_constraint as c').join('pg_class as r', 'r.oid', 'c.conrelid').select('c.conname').where({'c.conname': `${name}_pk`, 'r.relname': `${name}${SUFFIX}`}).first();
                    if (constraint) await db.raw('ALTER TABLE ?? RENAME CONSTRAINT ?? TO ??', [`${name}${SUFFIX}`, `${name}_pk`, `${name}_legacy_backup_pk`]);
                    const indexes = await db('pg_indexes').select('indexname').where({schemaname: 'public', tablename: `${name}${SUFFIX}`});
                    for (const {indexname} of indexes) if (!indexname.endsWith(SUFFIX)) await db.raw('ALTER INDEX ?? RENAME TO ??', [`public.${indexname}`, `${indexname}${SUFFIX}`]);
                }
                await schema.createAllTables({conn: connection});
                /** @param {string} name @param {readonly object[]} values @returns {Promise<void>} */
                const copy = async (name, values) => { for (const row of values) await db(target[name]).insert(row); };
                /** @param {string} name @returns {Promise<readonly object[]>} */
                /** @param {string} name @returns {Promise<readonly object[]>} */
                const rows = async (name) => db(`${await hasPublicTable(`${SOURCE[name]}${SUFFIX}`) ? `${SOURCE[name]}${SUFFIX}` : SOURCE[name]}`).select('*');
                if (await hasPublicTable(`${SOURCE.accessToken}${SUFFIX}`) && Number((await db(target.accessToken).count({count: '*'}).first())?.count ?? 0) === 0) await copy('accessToken', (await rows('accessToken')).map(({resource, ...row}) => ({...row, protected_endpoint: resource})));
                if (await hasPublicTable(`${SOURCE.audit}${SUFFIX}`) && Number((await db(target.audit).count({count: '*'}).first())?.count ?? 0) === 0) await copy('audit', (await rows('audit')).map(({resource, ...row}) => ({...row, operation_id: resource ?? null})));
                if (await hasPublicTable(`${SOURCE.delegation}${SUFFIX}`) && Number((await db(target.delegation).count({count: '*'}).first())?.count ?? 0) === 0) await copy('delegation', (await rows('delegation')).map(({resource, resource_connection_id, ...row}) => ({...row, authorization_revision: 1, permission_json: JSON.stringify({legacy_resource: resource, legacy_resource_connection_id: resource_connection_id ?? null})})));
                if (await hasPublicTable(`${SOURCE.oauthClient}${SUFFIX}`) && Number((await db(target.oauthClient).count({count: '*'}).first())?.count ?? 0) === 0) await copy('oauthClient', await rows('oauthClient'));
                if (await hasPublicTable(`${SOURCE.ownerSession}${SUFFIX}`) && Number((await db(target.ownerSession).count({count: '*'}).first())?.count ?? 0) === 0) await copy('ownerSession', await rows('ownerSession'));
                if (targetState.get('client') === 'missing' || Number((await db(target.client).count({count: '*'}).first())?.count ?? 0) === 0) {
                    const access = await db(target.accessToken).select('client_id');
                    await copy('client', [...new Map(access.map(({client_id}) => [client_id, client_id])).values()].map((client_id) => ({client_id, connected_at: new Date().toISOString(), disconnected_at: null, last_activity_at: null})));
                }
                const effective = compilation.effective;
                await db(target.snapshot).insert({dem: JSON.stringify(effective.model), fingerprint: effective.fingerprint, provenance: JSON.stringify(effective.provenance)}).onConflict('fingerprint').ignore();
                const snapshot = await db(target.snapshot).where({fingerprint: effective.fingerprint}).first();
                if (!(await db(target.application).where({status: 'applied', target_snapshot_id: snapshot.id}).first())) await db(target.application).insert({status: 'applied', source_snapshot_id: null, target_snapshot_id: snapshot.id, completed_at: new Date().toISOString()});
                for (const [key, name] of Object.entries(SOURCE)) if (await hasPublicTable(`${name}${SUFFIX}`)) {
                    const sourceCount = Number((await db(`${name}${SUFFIX}`).count({count: '*'}).first())?.count ?? 0);
                    const targetCount = Number((await db(target[key]).count({count: '*'}).first())?.count ?? 0);
                    if (sourceCount !== targetCount) throw new Error(`Migration verification failed for '${key}': source=${sourceCount}, target=${targetCount}. Backup tables were retained.`);
                }
                if (await hasPublicTable(`${SOURCE.accessToken}${SUFFIX}`) && Number((await db(target.accessToken).join(`${SOURCE.accessToken}${SUFFIX} as source`, `${target.accessToken}.digest`, 'source.digest').whereRaw(`${target.accessToken}.protected_endpoint IS DISTINCT FROM source.resource`).count({count: '*'}).first())?.count ?? 0) > 0) throw new Error('Migration verification failed for access token endpoint values. Backup tables were retained.');
                if (await hasPublicTable(`${SOURCE.audit}${SUFFIX}`) && Number((await db(target.audit).join(`${SOURCE.audit}${SUFFIX} as source`, `${target.audit}.id`, 'source.id').whereRaw(`${target.audit}.operation_id IS DISTINCT FROM source.resource`).count({count: '*'}).first())?.count ?? 0) > 0) throw new Error('Migration verification failed for audit operation values. Backup tables were retained.');
                for (const name of backups) if (await hasPublicTable(name)) await db.raw('DROP TABLE ??', [`public.${name}`]);
                return Object.freeze({status: 'migrated', backups: []});
            } finally { if (owned) await connection.disconnect(); }
        };
        Object.freeze(this);
    }
}

export const __deps__ = Object.freeze({default: Object.freeze({config: 'TeqFw_Db_Back_Config$', connection: 'TeqFw_Db_Back_RDb_Connect$', compile: 'TeqFw_Db_Back_Dem_Compile$', schema: 'TeqFw_Db_Back_RDb_Schema$', schemaProvider: 'Pde_Runtime_Storage_Schema$'})});
