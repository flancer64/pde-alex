// @ts-check

/**
 * @namespace Pde_Alex_Bootstrap_Di_Postprocessor
 * @description Orders CMS static exclusions after Runtime authentication and authorization handlers.
 */

/**
 * @param {object} deps
 * @param {TeqFw_Web_Back_Dto_Info__Factory} deps.dtoInfo
 * @returns {(value: unknown, context: TeqFw_Di_Container_ResolutionContext) => unknown}
 */
export default function Postprocessor({dtoInfo}) {
    return function hostPostprocessor(value, context) {
        if (context.depId.address !== 'Fl32_Cms_Back_Web_Handler_StaticRoute') return value;
        const handler = /** @type {Fl32_Cms_Back_Web_Handler_StaticRoute} */ (value);
        const original = /** @type {TeqFw_Web_Back_Dto_Info} */ (handler.getRegistrationInfo());
        const info = dtoInfo.create({
            ...original,
            after: [...original.after,
                'Pde_Runtime_Web_Handler_DeskGuard',
                'Pde_Runtime_Web_Handler_Delegate',
                'Pde_Runtime_Web_Handler_Control',
                'Pde_Runtime_Web_Handler_Mcp',
            ],
        });
        return Object.freeze({
            getRegistrationInfo: () => info,
            handle: (/** @type {TeqFw_Web_Back_Pipeline_RequestContext} */ request) => handler.handle(request),
        });
    };
}

export const __deps__ = Object.freeze({
    default: Object.freeze({dtoInfo: 'TeqFw_Web_Back_Dto_Info__Factory$'}),
});
