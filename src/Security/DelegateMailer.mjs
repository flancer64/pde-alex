// @ts-check

/**
 * @namespace Pde_Alex_Security_DelegateMailer
 * @description Adds host-owned diagnostics around Runtime Delegate email delivery.
 */
export default class DelegateMailer {
    /**
     * @param {object} deps
     * @param {any} deps.mailer
     * @param {TeqFw_Log_Provider} deps.logger
     */
    constructor({mailer, logger}) {
        const log = logger.forSource('Pde_Alex_Security_DelegateMailer');

        /** @param {object} request @returns {Promise<void>} */
        this.sendLoginLink = async function (request) {
            try {
                await mailer.sendLoginLink(request);
            } catch (err) {
                log.error('Delegate login link delivery failed', {reason: 'smtp-delivery-failed', err});
                throw err;
            }
        };
        Object.freeze(this);
    }
}

export const __deps__ = Object.freeze({default: Object.freeze({
    mailer: 'Pde_Runtime_Security_DelegateMailer$',
    logger: 'TeqFw_Log_Provider$',
})});
