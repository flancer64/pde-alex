// @ts-check

/**
 * @namespace Pde_Alex_Bootstrap_DiConfig
 * @description Configures the application dependency container.
 */
export default class Configurator {
    /**
     * @param {TeqFw_Cli_Api_Container_Configurator_Params} params
     * @returns {TeqFw_Cli_Api_Container_Configurator_Configuration}
     */
    configure(params) {
        void params;
        return {
            container: {
                preprocessors: [
                    'Pde_Alex_Bootstrap_Di_Preprocessor$',
                ],
            },
        };
    }
}
