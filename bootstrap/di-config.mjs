// @ts-check

import WorldMapConfigurator from '@flancer32/pde-desk-world-map/bootstrap/di-config';

/**
 * Routes Runtime DelegateMailer composition through the host-owned logging decorator.
 *
 * @param {TeqFw_Di_Dto_DepId} dependency
 * @param {TeqFw_Di_Container_ResolutionContext} context
 * @returns {TeqFw_Di_Dto_DepId}
 */
function delegateMailerDecorator(dependency, context) {
    if (dependency.moduleName !== 'Pde_Runtime_Security_DelegateMailer') return dependency;
    if (context.parent?.moduleName !== 'Pde_Runtime_Security_DelegateAuthentication') return dependency;
    return Object.freeze({...dependency, moduleName: 'Pde_Alex_Security_DelegateMailer'});
}

/**
 * @namespace Pde_Alex_Bootstrap_DiConfig
 * @description Configures the application dependency container.
 */
export default class Configurator {
    /**
     * @param {object} deps
     * @param {ReadonlyArray<string>} deps.argv
     * @returns {TeqFw_Cli_Api_Container_Configurator_Configuration}
     */
    configure({argv, applicationRoot}) {
        const worldMap = new WorldMapConfigurator().configure({argv, applicationRoot});
        const preprocessors = [...(worldMap.preprocessors ?? []), delegateMailerDecorator];
        if (argv.includes('db:migrate')) preprocessors.push(function (dependency) {
            if (dependency.moduleName !== 'Pde_Runtime_Cli_Command_DbMigrate') return dependency;
            return Object.freeze({...dependency, moduleName: 'Pde_Alex_Cli_Command_LegacyRuntimeMigration'});
        });
        return {preprocessors};
    }
}
