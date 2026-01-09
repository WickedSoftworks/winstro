import inquirer from 'inquirer';
import colors from '../colors.ts';
import install_package from '../install/install_package.ts';
import write_config from '../config/write_config.ts';
import { createTaskLogger } from '../logging';

const cliLog = createTaskLogger('cli');

async function cli() {
    const answers = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'what would you like to do?',
            choices: ['install', 'write', 'exit'],
        },
    ]);

    switch (answers.action) {
        case 'install':
            cliLog.log('[✓] reading current config && installing', 'green');
            install_package();
            break;
        case 'write':
            cliLog.log('[✓] going to write mode!!', 'green');
            write_config();
            break;
        case 'exit':
            cliLog.log('[✗] exiting...', 'red');
            return;
        default:
            cliLog.log('[✗] invalid choice', 'red');
    }
}

export default cli;