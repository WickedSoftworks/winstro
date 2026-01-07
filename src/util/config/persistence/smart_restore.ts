import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { execSync } from 'child_process';
import colors from '../../colors';

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
                    colors.yellow('[⚠] [winstro::smart_restore]: No backup files found on partition');
                }
            } catch (err) {
                colors.yellow(`[⚠] [winstro::smart_restore]: Error reading backup partition: ${err}`);
            }
        } else {
            colors.yellow('[⚠] [winstro::smart_restore]: Backup partition "winstro-backup" not found');
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
        colors.yellow(`[⚠] [winstro::smart_restore]: Error finding backup partition: ${err}`);
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
                colors.yellow(`[⚠] [winstro::smart_restore]: File not found: ${trimmed}`);
                resolve(null);
            } else {
                resolve(null);
            }
        });
    });
}

async function restore_configs(backupFilePath: string): Promise<void> {
    try {
        if (!fs.existsSync(backupFilePath)) {
            colors.yellow(`[✗] [winstro::restore_configs]: Backup file not found: ${backupFilePath}`);
            throw new Error(`Backup file not found: ${backupFilePath}`);
        }
        
        colors.green('[✓] [winstro::restore_configs]: Starting configuration restore...');
        
        // Create temporary extraction directory
        const tempDir = path.join(process.env.TEMP || process.env.TMP || '', 'winstro-restore');
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        fs.mkdirSync(tempDir, { recursive: true });
        
        // Extract backup
        colors.green('[✓] [winstro::restore_configs]: Extracting backup...');
        await decompressFile(backupFilePath, tempDir);
        
        // Read metadata
        const metadataPath = path.join(tempDir, '_backup_metadata.json');
        if (!fs.existsSync(metadataPath)) {
            colors.yellow('[⚠] [winstro::restore_configs]: Warning: Backup metadata not found');
        }
        
        const metadata = fs.existsSync(metadataPath) 
            ? JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
            : null;
        
        // Restore configuration directories
        colors.green('[✓] [winstro::restore_configs]: Restoring configuration directories...');
        let restoredCount = 0;
        
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
            if (file === '_backup_metadata.json') continue;
            
            const sourcePath = path.join(tempDir, file);
            const originalDirName = file.replace(/_/g, (match, offset) => {
                // Try to reconstruct the original path
                return match;
            });
            
            // Map back to original directory
            const configDirs = metadata?.dirs || [];
            const originalPath = configDirs.find((dir: string) => 
                dir.replace(/[%\\:]/g, '_') === file
            );
            
            if (originalPath) {
                const expandedPath = expandEnvVars(originalPath);
                try {
                    // Backup existing config first
                    if (fs.existsSync(expandedPath)) {
                        const backupSuffix = `.backup-${new Date().getTime()}`;
                        fs.renameSync(expandedPath, expandedPath + backupSuffix);
                        colors.yellow(`[⚠] [winstro::restore_configs]: Backed up existing config: ${originalPath}${backupSuffix}`);
                    }
                    
                    // Restore config
                    copyDirSync(sourcePath, expandedPath);
                    restoredCount++;
                    colors.green(`[✓] [winstro::restore_configs]: Restored ${originalPath}`);
                } catch (err) {
                    colors.yellow(`[⚠] [winstro::restore_configs]: Failed to restore ${originalPath}: ${err}`);
                }
            }
        }
        
        // Clean up temp directory
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        colors.green(`[✓] [winstro::restore_configs]: Restore complete! Restored ${restoredCount} configuration directories`);
        if (metadata) {
            colors.green(`[i] [winstro::restore_configs]: Backup was created on: ${metadata.timestamp}`);
        }
    } catch (err) {
        colors.yellow(`[✗] [winstro::restore_configs]: Restore failed: ${err}`);
        throw err;
    }
}

function expandEnvVars(str: string): string {
    return str.replace(/%USERPROFILE%/g, process.env.USERPROFILE || '')
              .replace(/%APPDATA%/g, process.env.APPDATA || '')
              .replace(/%LOCALAPPDATA%/g, process.env.LOCALAPPDATA || '');
}

function copyDirSync(src: string, dest: string): void {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const files = fs.readdirSync(src);
    for (const file of files) {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);
        const stat = fs.statSync(srcPath);
        
        if (stat.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

async function decompressFile(sourceFile: string, outputDir: string): Promise<void> {
    const tar = require('tar');
    await tar.x({ file: sourceFile, cwd: outputDir, strip: 1 });
}


export default smart_restore;
