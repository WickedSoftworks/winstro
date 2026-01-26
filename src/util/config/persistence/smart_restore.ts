import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { /* execSync */ } from 'child_process';
import colors from '../../colors';
import { createTaskLogger } from '../../logging';
import { run as runProcess } from '../../run';

const srLog = createTaskLogger('smart_restore');

async function smart_restore(): Promise<void> {
    try {
        srLog.log('[✓] [winstro::smart_restore]: Checking for winstro backup partition...', 'green');
        
        // Find partition by volume label instead of drive letter
        const backupDrive = await findBackupPartition();
        
        if (backupDrive) {
            srLog.log(`[✓] [winstro::smart_restore]: Found backup partition at ${backupDrive}`, 'green');
            
            // Ensure drive path has backslash
            const drivePath = backupDrive.endsWith('\\') ? backupDrive : backupDrive + '\\';
            
            // List backup files on backup drive
            try {
                const backupFiles = fs.readdirSync(drivePath).filter(file => file.endsWith('.tar.gz'));
                
                if (backupFiles.length > 0) {
                    srLog.log(`[✓] [winstro::smart_restore]: Found ${backupFiles.length} backup file(s)`, 'green');
                    
                    // Use the most recent backup (sort by name/timestamp)
                    const latestBackup = backupFiles.sort().reverse()[0];
                    const backupPath = path.join(drivePath, latestBackup);
                    
                    srLog.log(`[✓] [winstro::smart_restore]: Using backup: ${latestBackup}`, 'green');
                    await restore_configs(backupPath);
                    return;
                } else {
                    srLog.log('[⚠] [winstro::smart_restore]: No backup files found on partition', 'yellow');
                }
            } catch (err) {
                srLog.log(`[⚠] [winstro::smart_restore]: Error reading backup partition: ${err}`, 'yellow');
            }
        } else {
            srLog.log('[⚠] [winstro::smart_restore]: Backup partition "winstro-backup" not found', 'yellow');
        }
        
        // Check default backup directory
        srLog.log('[✓] [winstro::smart_restore]: Checking default backup directory...', 'green');
        const defaultBackupDir = path.join(process.env.LOCALAPPDATA || '', 'winstro', 'backups');
        
        if (fs.existsSync(defaultBackupDir)) {
            try {
                const backupFiles = fs.readdirSync(defaultBackupDir).filter(file => file.endsWith('.tar.gz'));
                
                if (backupFiles.length > 0) {
                    srLog.log(`[✓] [winstro::smart_restore]: Found ${backupFiles.length} backup file(s) in default directory`, 'green');
                    
                    // Use the most recent backup (sort by name/timestamp)
                    const latestBackup = backupFiles.sort().reverse()[0];
                    const backupPath = path.join(defaultBackupDir, latestBackup);
                    
                    srLog.log(`[✓] [winstro::smart_restore]: Using backup: ${latestBackup}`, 'green');
                    await restore_configs(backupPath);
                    return;
                } else {
                    srLog.log('[⚠] [winstro::smart_restore]: No backup files found in default directory', 'yellow');
                }
            } catch (err) {
                srLog.log(`[⚠] [winstro::smart_restore]: Error reading default backup directory: ${err}`, 'yellow');
            }
        } else {
            srLog.log('[⚠] [winstro::smart_restore]: Default backup directory does not exist', 'yellow');
        }
        
        // Fallback: Ask user for path
        srLog.log('[✓] [winstro::smart_restore]: Prompting for backup path...', 'green');
        const backupPath = await promptForPath();
        
        if (backupPath) {
            await restore_configs(backupPath);
            srLog.log(`[✓] [winstro::smart_restore]: restore_configs called with ${backupPath}`, 'green');
        } else {
            colors.yellow('[✗] [winstro::smart_restore]: No backup path provided, aborting restore');
        }
    } catch (err) {
        srLog.log(`[✗] [winstro::smart_restore]: Smart restore failed: ${err}`, 'red');
        throw err;
    }
}

async function findBackupPartition(): Promise<string | null> {
    try {
        const psCommand = `
            $volume = Get-Volume | Where-Object { $_.FileSystemLabel -eq 'winstro-backup' } | Select-Object -First 1
            if ($volume -and $volume.DriveLetter) {
                Write-Output ($volume.DriveLetter + ':')
            }
        `.trim();
        
        const encodedCommand = Buffer.from(psCommand, 'utf16le').toString('base64');
        const res = await runProcess('smart_restore', 'powershell.exe', ['-NoProfile', '-EncodedCommand', encodedCommand]);
        
        // Filter out CLIXML and get the drive letter
        const lines = (res.stdout || '').split('\n');
        const driveLine = lines.find(line => line.trim().match(/^[A-Z]:$/));
        
        if (driveLine) {
            return driveLine.trim();
        }

        return null;
    } catch (err) {
        srLog.log(`[⚠] [winstro::smart_restore]: Error finding backup partition: ${err}`, 'yellow');
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
                srLog.log(`[⚠] [winstro::smart_restore]: File not found: ${trimmed}`, 'yellow');
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
            srLog.log(`[✗] [winstro::restore_configs]: Backup file not found: ${backupFilePath}`, 'red');
            throw new Error(`Backup file not found: ${backupFilePath}`);
        }
        
        srLog.log('[✓] [winstro::restore_configs]: Starting configuration restore...', 'green');
        
        // Create temporary extraction directory
        const tempDir = path.join(process.env.LOCALAPPDATA || '', 'winstro', 'temp', 'restore');
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        fs.mkdirSync(tempDir, { recursive: true });
        
        // Extract backup
        srLog.log('[✓] [winstro::restore_configs]: Extracting backup...', 'green');
        await decompressFile(backupFilePath, tempDir);
        
        // Check if extraction created subdirectories we need to navigate
        const extractedContents = fs.readdirSync(tempDir);
        const files = extractedContents.filter(f => fs.statSync(path.join(tempDir, f)).isFile());
        const dirs = extractedContents.filter(f => fs.statSync(path.join(tempDir, f)).isDirectory());
        srLog.log(`[i] [winstro::restore_configs]: Extracted files: ${files.join(', ')}`, 'blue');
        srLog.log(`[i] [winstro::restore_configs]: Extracted directories: ${dirs.join(', ')}`, 'blue');
        
        // Read metadata
        const metadataPath = path.join(tempDir, '_backup_metadata.json');
        if (!fs.existsSync(metadataPath)) {
            srLog.log('[⚠] [winstro::restore_configs]: Warning: Backup metadata not found', 'yellow');
            srLog.log(`[i] [winstro::restore_configs]: Looking in: ${metadataPath}`, 'blue');
        }
        
        const metadata = fs.existsSync(metadataPath) 
            ? JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
            : null;
        
        // Restore configuration directories
        srLog.log('[✓] [winstro::restore_configs]: Restoring configuration directories...', 'green');
        let restoredCount = 0;
        
        const itemsToRestore = fs.readdirSync(tempDir);
        for (const file of itemsToRestore) {
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
                        srLog.log(`[⚠] [winstro::restore_configs]: Backed up existing config: ${originalPath}${backupSuffix}`, 'yellow');
                    }
                    
                    // Restore config
                    copyDirSync(sourcePath, expandedPath);
                    restoredCount++;
                    srLog.log(`[✓] [winstro::restore_configs]: Restored ${originalPath}`, 'green');
                } catch (err) {
                    srLog.log(`[⚠] [winstro::restore_configs]: Failed to restore ${originalPath}: ${err}`, 'yellow');
                }
            }
        }
        
        // Clean up temp directory
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        srLog.log(`[✓] [winstro::restore_configs]: Restore complete! Restored ${restoredCount} configuration directories`, 'green');
        if (metadata) {
            srLog.log(`[i] [winstro::restore_configs]: Backup was created on: ${metadata.timestamp}`, 'blue');
        }
    } catch (err) {
        srLog.log(`[✗] [winstro::restore_configs]: Restore failed: ${err}`, 'red');
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
    // Use system tar command for extraction (more reliable than tar package)
    const psCommand = `
        tar -xzf "${sourceFile}" -C "${outputDir}"
        if ($LASTEXITCODE -ne 0) {
            throw "Tar extraction failed with code $LASTEXITCODE"
        }
    `.trim();
    
    const encodedCommand = Buffer.from(psCommand, 'utf16le').toString('base64');
    const res = await runProcess('smart_restore', 'powershell.exe', ['-NoProfile', '-EncodedCommand', encodedCommand]);
    
    if (res.code !== 0) {
        throw new Error(`Extraction failed with code ${res.code}`);
    }
}


export default smart_restore;