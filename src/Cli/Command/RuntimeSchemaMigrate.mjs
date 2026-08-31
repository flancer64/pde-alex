// @ts-check

/**
 * @namespace Pde_Alex_Cli_Command_RuntimeSchemaMigrate
 * @description Runs the host-owned, non-destructive Runtime PostgreSQL schema migration.
 */

/**
 * @param {object} deps
 * @param {Pde_Alex_Storage_RuntimeSchemaMigration} deps.migration
 * @param {TeqFw_Cli_Adapter_Io} deps.io
 * @returns {TeqFw_Cli_Dto_Command}
 */
export default function RuntimeSchemaMigrate({migration, io}) {
    return Object.freeze({
        id: 'db:migrate-runtime-schema',
        summary: 'Migrate the recognized legacy Runtime PostgreSQL schema without discarding source rows.',
        lifetime: 'finite',
        /** @returns {Promise<void>} */
        execute: async function () {
            const result = await migration.execute();
            io.write(`Runtime schema migration ${result.status}. Archived rows: ${result.archivedRows}.\n`);
        },
    });
}

export const __deps__ = Object.freeze({
    default: Object.freeze({
        migration: 'Pde_Alex_Storage_RuntimeSchemaMigration$',
        io: 'TeqFw_Cli_Adapter_Io$',
    }),
});
