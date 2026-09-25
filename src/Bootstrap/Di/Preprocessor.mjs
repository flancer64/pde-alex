// @ts-check

/**
 * @namespace Pde_Alex_Bootstrap_Di_Preprocessor
 * @description Applies the host's explicit dependency substitutions.
 */

/**
 * @param {object} deps
 * @param {TeqFw_Di_Enum_Lifestyle} deps.lifestyle
 * @returns {(dependency: TeqFw_Di_Dto_DepId, context: TeqFw_Di_Container_ResolutionContext) => TeqFw_Di_Dto_DepId}
 */
export default function Preprocessor({lifestyle}) {
    return function hostPreprocessor(dependency, context) {
        if (dependency.address === 'Fl32_Cms_Back_Api_Adapter') {
            return Object.freeze({...dependency, address: 'Fl32_Cms_Back_Di_Replace_Adapter'});
        }

        if (dependency.address === 'Fl32_Tmpl_Back_Api_Engine') {
            return Object.freeze({...dependency, address: 'Fl32_Tmpl_Back_Service_Engine_Nunjucks'});
        }

        if (dependency.address === 'Pde_Runtime_Security_DelegateMailer'
            && context.parent?.address === 'Pde_Runtime_Security_DelegateAuthentication') {
            return Object.freeze({...dependency, address: 'Pde_Alex_Security_DelegateMailer'});
        }

        if (dependency.address === 'TeqFw_Db_Back_RDb_Connect' && dependency.lifestyle === lifestyle.SINGLETON) {
            const addresses = context.stack.map((item) => item.address);
            const isWorldMapStateBranch = addresses.some((address) => address.startsWith('Pde_Desk_World_Map_'))
                && addresses.some((address) => address.startsWith('Alarisa_Back_State_'));
            if (isWorldMapStateBranch) {
                return Object.freeze({...dependency, address: 'Pde_Desk_World_Map_Back_State_Connection'});
            }
        }

        if (dependency.address === 'Pde_Runtime_Cli_Command_DbMigrate') {
            return Object.freeze({...dependency, address: 'Pde_Alex_Cli_Command_LegacyRuntimeMigration'});
        }

        return dependency;
    };
}

export const __deps__ = Object.freeze({
    default: Object.freeze({lifestyle: 'TeqFw_Di_Enum_Lifestyle'}),
});
