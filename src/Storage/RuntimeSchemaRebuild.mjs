// @ts-check

/**
 * @namespace Pde_Alex_Storage_RuntimeSchemaRebuild
 * @description Rebuilds the Runtime DEM schema while preserving readable rows.
 */
export default class RuntimeSchemaRebuild {
    /**
     * @param {object} deps
     * @param {TeqFw_Db_Back_Config} deps.config
     * @param {TeqFw_Db_Back_RDb_Connect} deps.connection
     * @param {TeqFw_Db_Back_Dem_Compile} deps.compile
     * @param {TeqFw_Db_Back_RDb_Rebuild} deps.rebuild
     * @param {Pde_Runtime_Storage_Schema} deps.schemaProvider
     */
    constructor({config, connection, compile, rebuild, schemaProvider}) {
        /** @returns {Promise<object>} */
        this.execute = async function () {
            await connection.init(config.get());
            try {
                const compilation = compile.assertResult({value: await compile.exec({
                    adapter: connection.getDialectAdapter(),
                    fragments: [schemaProvider.getFragmentEnvelope()],
                    mapEnvelope: schemaProvider.getMapEnvelope(),
                })});
                const expectedTables = new Set(compilation.physical.tables.map((table) => table.name));
                const snapshot = {
                    readTable: async ({table}) => {
                        if (!expectedTables.has(table) || !(await connection.getSchemaBuilder().hasTable(table))) return [];
                        return connection.getClient()(table).select();
                    },
                };
                const evidence = await rebuild.exec({
                    mode: 'inPlace',
                    compilation,
                    sourceCompilation: compilation,
                    source: connection,
                    target: connection,
                    sourceId: 'pde_alex',
                    targetId: 'pde_alex',
                    snapshot,
                });
                if (evidence.status !== 'complete' || !evidence.dataComplete || evidence.transaction.outcome !== 'committed') {
                    throw new Error('Runtime DEM rebuild did not produce complete committed evidence.');
                }
                return evidence;
            } finally {
                await connection.disconnect();
            }
        };
        Object.freeze(this);
    }
}

export const __deps__ = Object.freeze({
    default: Object.freeze({
        config: 'TeqFw_Db_Back_Config$',
        connection: 'TeqFw_Db_Back_RDb_Connect$',
        compile: 'TeqFw_Db_Back_Dem_Compile$',
        rebuild: 'TeqFw_Db_Back_RDb_Rebuild$',
        schemaProvider: 'Pde_Runtime_Storage_Schema$',
    }),
});
