import isAdmin from "is-admin";
import colors from "./src/util/colors";
import cli from "./src/util/cli/cli";
import write_config from "./src/util/config/write_config";
import smart_backup from "./src/util/config/persistence/smart_backup";
import smart_restore from "./src/util/config/persistence/smart_restore";
import backup_to_partition from "./src/util/config/persistence/smart_backup";
import { logo, headless_logo, write_logo } from "./src/logo";

import { parseArgs } from 'node:util';
import install_package from "./src/util/install/install_package";
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
      type: 'string',
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
    colors.green('[✓] [winstro::main]: Write mode detected, prompting user to generate config file');
    write_config();
} else if (values.backup) {
    console.log(write_logo);
    colors.green('[✓] [winstro::main]: Backup/restore mode detected, checking for backup partition and backing up');
    smart_backup();
} else if (values.restore) {
    console.log(write_logo);
    colors.green(`[✓] [winstro::main]: Restore mode detected, attempting restoration from the `);
    smart_restore();
} else if (values.headless) {
    console.log(headless_logo);
    colors.green('[✓] [winstro::main]: headless mode detected, installing without prompts');
    install_package();
} else {
    main();
}


async function main() {
    console.log(logo);
    if (await isAdmin()) {
        colors.green("[✗] [winstro::main]: process already started as admin, skipping elevation warning")
        cli();
    } else {
        colors.yellow("[⚠] [winstro::main]:  process not running as admin, you might want to consider running it as admin to prevent issues with powershell signing.")
        cli();
    }
}