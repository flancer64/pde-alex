// @ts-check

/**
 * @namespace Pde_Alex_Cli_Lifecycle_Migration
 * @description Keeps Runtime startup out of the explicit database rebuild command.
 */
export default class Migration {
    /** Creates the no-op lifecycle used by the explicit migration command. */
    constructor() {
        /** @returns {Promise<void>} */
        this.onStartup = async function () {};

        /** @returns {Promise<void>} */
        this.onShutdown = async function () {};
    }
}
