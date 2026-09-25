// @ts-check

/**
 * @namespace Pde_Alex_Cli_Command_AppCheck
 * @description Verifies the host's started Runtime and Desk composition.
 */

const REQUIRED_DESKS = Object.freeze({
    'pde.echo': Object.freeze({
        capabilities: Object.freeze(['pde.echo']),
        operations: Object.freeze(['pde.echo']),
    }),
    filesystem: Object.freeze({
        capabilities: Object.freeze(['filesystem.read', 'filesystem.write']),
        operations: Object.freeze([
            'filesystem.directory.list',
            'filesystem.file.read',
            'filesystem.file.write',
            'filesystem.directory.create',
        ]),
    }),
    telegram: Object.freeze({
        capabilities: Object.freeze([
            'telegram.account.read',
            'telegram.contacts.read',
            'telegram.chats.read',
            'telegram.history.read',
            'telegram.messages.send',
        ]),
        operations: Object.freeze([
            'telegram.account.getMe',
            'telegram.contact.list',
            'telegram.chat.list',
            'telegram.chat.get',
            'telegram.chat.search',
            'telegram.chat.history',
            'telegram.message.get',
            'telegram.message.send',
        ]),
    }),
    worldMap: Object.freeze({
        capabilities: Object.freeze(['worldMap.read']),
        operations: Object.freeze([
            'worldMap.map.read',
            'worldMap.picture.read',
            'worldMap.object.read',
        ]),
    }),
});

const REQUIRED_EDITORS = Object.freeze([
    Object.freeze({deskId: 'filesystem', capabilityId: 'filesystem.read'}),
    Object.freeze({deskId: 'filesystem', capabilityId: 'filesystem.write'}),
    Object.freeze({deskId: 'telegram', capabilityId: 'telegram.messages.send'}),
]);

/**
 * @param {object} deps
 * @param {Pde_Sdk_Desk_Registry} deps.registry
 * @param {Pde_Runtime_Web_DelegationEditorRegistry} deps.editors
 * @param {TeqFw_Cli_Adapter_Io} deps.io
 * @returns {TeqFw_Cli_Dto_Command}
 */
export default function AppCheck({registry, editors, io}) {
    return Object.freeze({
        id: 'app:check',
        summary: 'Check application startup and package composition.',
        lifetime: 'finite',
        arguments: [],
        options: [],
        /** @returns {Promise<void>} */
        execute: async function() {
            const desks = registry.desks();
            const actualById = new Map();
            for (const desk of desks) {
                if (actualById.has(desk.deskId)) throw new Error(`Duplicate Desk ID registered: ${desk.deskId}.`);
                actualById.set(desk.deskId, desk);
            }

            const failures = [];
            for (const [deskId, expected] of Object.entries(REQUIRED_DESKS)) {
                const desk = actualById.get(deskId);
                if (!desk) {
                    failures.push(`Missing required Desk '${deskId}'.`);
                    continue;
                }
                const actualCapabilities = new Set(desk.capabilities.map(({capabilityId}) => capabilityId));
                const actualOperations = new Set(desk.operations.map(({operationId}) => operationId));
                for (const capabilityId of expected.capabilities) {
                    if (!actualCapabilities.has(capabilityId)) failures.push(`Desk '${deskId}' is missing Capability '${capabilityId}'.`);
                }
                for (const operationId of expected.operations) {
                    if (!actualOperations.has(operationId)) failures.push(`Desk '${deskId}' is missing Operation '${operationId}'.`);
                }
            }

            for (const {deskId, capabilityId} of REQUIRED_EDITORS) {
                if (!editors.get(deskId, capabilityId)) failures.push(`Missing Delegation editor for '${deskId}/${capabilityId}'.`);
            }

            if (failures.length) throw new Error(`Application composition check failed:\n- ${failures.join('\n- ')}`);

            const operationCount = desks.reduce((count, desk) => count + desk.operations.length, 0);
            const capabilityCount = desks.reduce((count, desk) => count + desk.capabilities.length, 0);
            io.write(`Application composition check passed: ${desks.length} Desks, ${operationCount} Operations, ${capabilityCount} Capabilities, ${REQUIRED_EDITORS.length} Delegation editors.\n`);
        },
    });
}

export const __deps__ = Object.freeze({
    default: Object.freeze({
        registry: 'Pde_Sdk_Desk_Registry$',
        editors: 'Pde_Runtime_Web_DelegationEditorRegistry$',
        io: 'TeqFw_Cli_Adapter_Io$',
    }),
});
