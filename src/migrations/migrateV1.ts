import type KankaFoundry from '../KankaFoundry';
import { KankaApiEntity } from '../types/kanka';

async function migrateAll(module: KankaFoundry): Promise<void> {
    const campaignId = module.currentCampaign?.id;

    if (!campaignId) {
        return;
    }

    const entities = await module.api.getAllEntities(
        campaignId,
        [
            'ability',
            'character',
            'location',
            'race',
            'organisation',
            'family',
            'item',
            'journal',
            'note',
            'quest',
        ],
    );

    const updateEntities = game.journal
        .filter(e => e.getFlag(module.name, 'id') && !e.getFlag(module.name, 'snapshot'))
        .map(entry => entities.find(e => e.id === entry.getFlag(module.name, 'entityId')))
        .filter((entity): entity is KankaApiEntity => !!entity);

    await Promise.all(game.journal
        .filter(e => e.getFlag(module.name, 'id') && !e.getFlag(module.name, 'snapshot'))
        .map(async (entry) => {
            const entity = entities.find(e => e.id === entry.getFlag(module.name, 'entityId'));
            if (!entity) return;
            await entry.setFlag(module.name, 'id', entity.id);
            await entry.unsetFlag(module.name, 'entityId');
            await entry.unsetFlag(module.name, 'updatedAt');
            await entry.unsetFlag(module.name, 'campaignId');
        }));

    await module.journals.write(campaignId, updateEntities, entities);

    await Promise.all(game.folders
        .filter(folder => folder.getFlag(module.name, 'folderType'))
        .map(async (folder) => {
            const folderType = folder.getFlag(module.name, 'folderType');
            if (folderType !== 'type') {
                await folder.unsetFlag(module.name, 'type');
            }
            await folder.unsetFlag(module.name, 'folderType');
            await folder.unsetFlag(module.name, 'id');
        }));

    module.showInfo('migration.success');
}

export default function migrateV1(module: KankaFoundry): void {
    const outdatedJournals = game.journal.filter(e => e.getFlag(module.name, 'id') && !e.getFlag(module.name, 'snapshot'));
    const outdatedFolders = game.folders.filter(folder => folder.getFlag(module.name, 'folderType'));

    console.log('FOO', outdatedFolders, outdatedJournals);

    if (outdatedFolders.length === 0 && outdatedJournals.length === 0) {
        return;
    }

    const dialog = new Dialog({
        title: module.getMessage('migration.dialog.header'),
        content: module.formatMessage('migration.dialog.text', {
            documentCount: outdatedJournals.length,
            folderCount: outdatedFolders.length,
            campaignName: module.currentCampaign?.name,
        }),
        buttons: {
            yes: {
                icon: '<i class="fas fa-check"></i>',
                label: module.getMessage('migration.dialog.action.yes'),
                async callback() {
                    await migrateAll(module);
                    await dialog.close();
                },
            },
            no: {
                icon: '<i class="fas fa-times"></i>',
                label: module.getMessage('migration.dialog.action.no'),
                async callback() {
                    await dialog.close();
                },
            },
        },
        default: 'no',
    }, { width: 720 });
    dialog.render(true);
}