import isAdmin from "is-admin";
import cli from "./src/util/cli/cli";
import smart_backup from "./src/util/config/persistence/smart_backup";
import smart_restore from "./src/util/config/persistence/smart_restore";
import { createTaskLogger } from './src/util/logging';

const mainLog = createTaskLogger('main');
import { logo, headless_logo, write_logo } from "./src/logo";

import { parseArgs } from 'node:util';
import install_package from "./src/util/install/install_package";
import smart_write from "./src/util/config/smart_write";
const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    help: {
      type: 'boolean',
    },
    headless: {
      type: 'boolean',
    },
    qwrite: {
      type: 'boolean',
    },
    backup: {
      type: 'boolean',
    },
    restore: {
      type: 'boolean',
    },
  },
  strict: true,
  allowPositionals: true,
});

if (values.help) {
    console.log(`
winstro - Windows made as a distro
Usage: winstro [options]
Options:
  --help                      Show this help message
  --headless                  Run in headless mode (no interactive prompts)
  --qwrite                    (MANUALLY) Generate a config file based on currently installed packages
  --backup                    Backup all application configurations to a compressed archive
  --restore <path>            Restore configurations from a backup file (provide full path to .tar.gz)
Examples:
  winstro --headless
  winstro --restore "C:\\Users\\YourName\\AppData\\Local\\winstro-backups\\winstro-backup-2025-12-19T14-30-45-123Z.tar.gz"
  winstro --backup-partition "C:\\Users\\YourName\\AppData\\Local\\winstro-backups\\winstro-backup-2025-12-19T14-30-45-123Z.tar.gz"
`);
    process.exit(0);
}

if (values.qwrite) {
    console.log(write_logo);
  mainLog.log('Write mode detected, prompting user to generate config file', 'green');
    await smart_write();
} else if (values.backup) {
    console.log(write_logo);
  mainLog.log('Backup mode detected, triggering smart_backup', 'green');
    await smart_backup();
} else if (values.restore) {
    console.log(write_logo);
  mainLog.log('Restore mode detected, triggering smart_restore', 'green');
    await smart_restore();
} else if (values.headless) {
    console.log(headless_logo);
  mainLog.log('Headless mode detected, triggering install_package', 'green');
    await install_package();
} else {
    main();
}


async function main() {
    console.log(logo);
    if (await isAdmin()) {
        mainLog.log("[✓] [winstro::main]: process already started as admin, skipping elevation warning", 'green')
        await cli();
    } else {
        mainLog.log("[⚠] [winstro::main]:  process not running as admin, you might want to consider running it as admin to prevent issues with powershell signing.", 'yellow');
        await cli();
    }
}