import colors from '../colors'
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { createTaskLogger } from '../logging';

const wcLog = createTaskLogger('write_config');

function write_config() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('[winstro::write_config]: Enter package names separated by commas, example: (Creator.Package1,Creator.Package2): ', (answer) => {
        const packages = answer.split(',').map(pkg => pkg.trim()).filter(pkg => pkg.length > 0);
        const configContent = `const winget_requirements: string[] = [${packages.map(pkg => `'${pkg}'`).join(', ')}];\nexport default winget_requirements;\n`;
        const configDir = path.resolve(__dirname, '../../../config');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        fs.writeFileSync(path.join(configDir, 'requirements.winget.ts'), configContent, 'utf8');
        console.log(colors.green('[winstro::write_config]: requirements.winget.ts has been created successfully.'));
        wcLog.log(`Created requirements.winget.ts with ${packages.length} packages`, 'green');
        rl.close();
    });

    // Example of the config file:
    /*
    const winget_requirements: string[] = ['TranslucentTB'];
    export default winget_requirements;
    */

}

export default write_config