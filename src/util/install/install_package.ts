import winget_requirements from '../../../config/requirements.winget';
import { createTaskLogger } from '../logging';
import { run as runProcess } from '../run';

const ipLog = createTaskLogger('install_package');

async function install_package() {
    for (const requirement of winget_requirements) {
        const args = ['install', requirement, '--silent', '--accept-package-agreements', '--accept-source-agreements'];
        ipLog.log(`Starting install for ${requirement} with args: ${args.join(' ')}`, 'green');
        try {
            const res = await runProcess('install_package', 'winget', args);
            if (res.code !== 0) {
                ipLog.log(`[✗] [winstro::install_package]: error installing package ${requirement}, exit ${res.code}`, 'red');
                throw new Error(`Exit code ${res.code}`);
            }
            ipLog.log(`Finished ${requirement} successfully (exit ${res.code})`, 'green');
        } catch (error) {
            // already logged; continue with next package
        }
    }
}

export default install_package;