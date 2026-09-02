// @ts-check

import WorldMapConfigurator from '@flancer32/pde-desk-world-map/bootstrap/di-config';

/**
 * @namespace Pde_Alex_Bootstrap_DiConfig
 * @description Configures host-only dependency substitutions for maintenance commands.
 */
export default class Configurator {
    /**
     * @param {object} deps
     * @param {ReadonlyArray<string>} deps.argv
     * @returns {TeqFw_Cli_Api_Container_Configurator_Configuration}
     */
    configure({argv, applicationRoot}) {
        const migrationCommand = argv.includes('app:migrate:260831');
        const worldMap = new WorldMapConfigurator().configure({argv, applicationRoot});
        const preprocessors = [...(worldMap.preprocessors ?? [])];
        if (migrationCommand) preprocessors.push(function (dependency) {
                if (dependency.moduleName !== 'Pde_Runtime_Lifecycle') return dependency;
                return Object.freeze({...dependency, moduleName: 'Pde_Alex_Cli_Lifecycle_Migration'});
            });
        return {preprocessors};
    }
}
