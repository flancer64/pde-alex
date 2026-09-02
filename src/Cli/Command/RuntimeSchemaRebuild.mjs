// @ts-check

/**
 * @namespace Pde_Alex_Cli_Command_RuntimeSchemaRebuild
 * @description Rebuilds the Runtime DEM schema with readable-row preservation.
 */

/**
 * @param {object} deps
 * @param {Pde_Alex_Storage_RuntimeSchemaRebuild} deps.rebuild
 * @param {TeqFw_Cli_Adapter_Io} deps.io
 * @returns {TeqFw_Cli_Dto_Command}
 */
export default function RuntimeSchemaRebuild({rebuild, io}) {
    return Object.freeze({
        id: 'app:migrate:260831',
        summary: 'Rebuild the Runtime DEM schema and preserve readable rows.',
        lifetime: 'finite',
        /** @returns {Promise<void>} */
        execute: async function () {
            const evidence = await rebuild.execute();
            const rows = evidence.tables.reduce((sum, table) => sum + table.targetRows, 0);
            io.write(`Runtime DEM rebuild complete. Tables: ${evidence.tables.length}. Rows: ${rows}.\n`);
        },
    });
}

export const __deps__ = Object.freeze({
    default: Object.freeze({
        rebuild: 'Pde_Alex_Storage_RuntimeSchemaRebuild$',
        io: 'TeqFw_Cli_Adapter_Io$',
    }),
});
