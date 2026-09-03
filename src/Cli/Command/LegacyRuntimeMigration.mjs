// @ts-check

/**
 * @namespace Pde_Alex_Cli_Command_LegacyRuntimeMigration
 * @description Runs the explicit legacy Runtime DEM migration.
 */

/** @param {object} deps @param {Pde_Alex_Storage_LegacyRuntimeMigration} deps.migration @param {TeqFw_Cli_Adapter_Io} deps.io @returns {TeqFw_Cli_Dto_Command} */
export default function LegacyRuntimeMigration({migration, io}) {
    return Object.freeze({id: 'db:migrate-legacy-runtime', summary: 'Migrate the legacy Runtime schema and retain source backups.', lifetime: 'finite', execute: async function () {
        const result = await migration.execute();
        io.write(`Legacy Runtime migration ${result.status}. Backups: ${result.backups.length}.\n`);
    }});
}

export const __deps__ = Object.freeze({default: Object.freeze({migration: 'Pde_Alex_Storage_LegacyRuntimeMigration$', io: 'TeqFw_Cli_Adapter_Io$'})});
