import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { execSync } from 'child_process';
import colors from '../../colors';
import restore_configs from './restore_configs';

async function smart_restore(): Promise<void> {
    try {
        colors.green('[✓] [winstro::smart_restore]: Checking for winstro backup partition...');
        
        // Find partition by volume label instead of drive letter
        const backupDrive = await findBackupPartition();
        
        if (backupDrive) {
            colors.green(`[✓] [winstro::smart_restore]: Found backup partition at ${backupDrive}`);
            
            // List backup files on backup drive
            try {
                const backupFiles = fs.readdirSync(backupDrive).filter(file => file.endsWith('.tar.gz'));
                
                if (backupFiles.length > 0) {
                    colors.green(`[✓] [winstro::smart_restore]: Found ${backupFiles.length} backup file(s)`);
                    
                    // Use the most recent backup (sort by name/timestamp)
                    const latestBackup = backupFiles.sort().reverse()[0];
                    const backupPath = path.join(backupDrive, latestBackup);
                    
                    colors.green(`[✓] [winstro::smart_restore]: Using backup: ${latestBackup}`);
                    await restore_configs(backupPath);
                    return;
                } else {
                    colors.yellow('[⚠ ] [winstro::smart_restore]: No backup files found on partition');
                }
            } catch (err) {
                colors.yellow(`[⚠ ] [winstro::smart_restore]: Error reading backup partition: ${err}`);
            }
        } else {
            colors.yellow('[⚠ ] [winstro::smart_restore]: Backup partition "winstro-backup" not found');
        }
        
        // Fallback: Ask user for path
        colors.green('[✓] [winstro::smart_restore]: Prompting for backup path...');
        const backupPath = await promptForPath();
        
        if (backupPath) {
            await restore_configs(backupPath);
        } else {
            colors.yellow('[✗] [winstro::smart_restore]: No backup path provided, aborting restore');
        }
    } catch (err) {
        colors.yellow(`[✗] [winstro::smart_restore]: Smart restore failed: ${err}`);
        throw err;
    }
}

async function findBackupPartition(): Promise<string | null> {
    try {
        const psCommand = `
            Get-Volume | Where-Object { $_.FileSystemLabel -eq 'winstro-backup' } | 
            Select-Object -First 1 | 
            ForEach-Object { $_.DriveLetter + ':' }
        `;
        
        const result = execSync(`powershell -Command "${psCommand.replace(/"/g, '\\"')}"`, { 
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
        
        if (result && result.length === 2) {
            return result;
        }
        
        return null;
    } catch (err) {
        colors.yellow(`[⚠ ] [winstro::smart_restore]: Error finding backup partition: ${err}`);
        return null;
    }
}

async function promptForPath(): Promise<string | null> {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('[winstro::smart_restore]: Enter path to backup file (or press Enter to cancel): ', (answer) => {
            rl.close();
            const trimmed = answer.trim();
            
            if (trimmed && fs.existsSync(trimmed)) {
                resolve(trimmed);
            } else if (trimmed) {
                colors.yellow(`[⚠ ] [winstro::smart_restore]: File not found: ${trimmed}`);
                resolve(null);
            } else {
                resolve(null);
            }
        });
    });
}

export default smart_restore;
