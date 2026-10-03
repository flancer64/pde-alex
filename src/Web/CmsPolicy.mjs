// @ts-check

/**
 * @namespace Pde_Alex_Web_CmsPolicy
 * @description Reserves Runtime UI and Desk resources from CMS publication and template routing.
 */

/**
 * @param {object} deps
 * @param {Fl32_Cms_Back_Config} deps.config
 * @returns {Fl32_Cms_Back_Publication_Policy}
 */
export default function CmsPolicy({config}) {
    return Object.freeze({
        getMode: () => config.getPublicationFamilies().length ? 'families' : 'site',
        getStaticPrefixes: () => ['/assets/', '/pub/', '/person/', '/delegate/', '/oauth/', '/desk/', '/vendor/'],
        getPresentationName: () => 'publication.html',
    });
}

export const __deps__ = Object.freeze({
    default: Object.freeze({config: 'Fl32_Cms_Back_Config$'}),
});
