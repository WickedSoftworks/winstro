import inquirer from 'inquirer';
import install_package from '../install/install_package.ts';
import { createTaskLogger } from '../logging';
import { smart_write } from '../config/smart_write.ts';
import smart_backup from '../config/persistence/smart_backup.ts';
import smart_restore from '../config/persistence/smart_restore.ts';

const cliLog = createTaskLogger('cli');

async function cli() {
    const answers = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'what would you like to do?',
            choices: ['install', 'write', 'backup', 'restore', 'exit'],
        },
    ]);

    switch (answers.action) {
        case 'install':
            cliLog.log('[✓] reading current config && installing', 'green');
            await install_package();
            break;
        case 'write':
            cliLog.log('[✓] going to write mode!!', 'green');
            await smart_write();
            break;
        case 'backup':
            cliLog.log('[✓] going to backup mode!!', 'green');
            await smart_backup();
            break;
        case 'restore':
            cliLog.log('[✓] going to restore mode', 'green');
            await smart_restore();
            break;
        case 'exit':
            cliLog.log('[✗] exiting...', 'red');
            return;
        default:
            cliLog.log('[✗] invalid choice', 'red');
    }
}

export default cli;