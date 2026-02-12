import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { /* execSync */ } from 'child_process';
import colors from '../../colors';
import { createTaskLogger } from '../../logging';
import { run as runProcess } from '../../run';

const srLog = createTaskLogger('smart_restore');

/**
 * Restores the user's configurations from the most recent backup
 * @returns void
 */
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
                    
                    // Restoration successful - remove partition and expand drive
                    srLog.log('[✓] [winstro::smart_restore]: Restoration complete, cleaning up backup partition...', 'green');
                    await removeBackupPartitionAndExpand(backupDrive);
                    
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

/**
 * Finds the backup partition by looking for a volume with the label "winstro-backup"
 * @returns The drive letter of the backup partition if found, otherwise null
 */
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

/**
 * Prompts the user to enter the path to a backup file
 * @returns The path entered by the user if valid, otherwise null
 */
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

/**
 * Restores the user's configurations from a specified backup file
 * @param backupFilePath The path to the backup file to restore from
 * @returns void
 */
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

/**
 * Expands environment variables in a given string
 * @param str The string containing environment variables to expand
 * @returns The string with environment variables expanded
 */
function expandEnvVars(str: string): string {
    return str.replace(/%USERPROFILE%/g, process.env.USERPROFILE || '')
              .replace(/%APPDATA%/g, process.env.APPDATA || '')
              .replace(/%LOCALAPPDATA%/g, process.env.LOCALAPPDATA || '');
}

/**
 * Copies a directory and its contents recursively from source to destination
 * @param src Source directory path
 * @param dest Destination directory path
 */
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

/**
 * Decompresses a .tar.gz file to the specified output directory
 * @param sourceFile The path to the .tar.gz file to decompress
 * @param outputDir The directory to extract the contents to
 */
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

/**
 * Removes the backup partition and expands the main drive to use the freed space
 * @param driveLetter The drive letter of the backup partition to remove
 * @returns void
 */
async function removeBackupPartitionAndExpand(driveLetter: string): Promise<void> {
    try {
        srLog.log('[✓] [winstro::cleanup]: Removing backup partition and expanding main drive...', 'green');
        
        // Get the disk number and partition number for the backup drive
        const psGetPartitionInfo = `
            $volume = Get-Volume -DriveLetter '${driveLetter.replace(':', '')}'
            $partition = Get-Partition | Where-Object { $_.DriveLetter -eq '${driveLetter.replace(':', '')}' }
            if ($partition) {
                Write-Output "DISK:$($partition.DiskNumber):PARTITION:$($partition.PartitionNumber)"
            }
        `.trim();
        
        const encodedGetInfo = Buffer.from(psGetPartitionInfo, 'utf16le').toString('base64');
        const infoRes = await runProcess('smart_restore', 'powershell.exe', ['-NoProfile', '-EncodedCommand', encodedGetInfo]);
        
        const infoMatch = (infoRes.stdout || '').match(/DISK:(\d+):PARTITION:(\d+)/);
        if (!infoMatch) {
            srLog.log('[⚠] [winstro::cleanup]: Could not determine partition info, skipping cleanup', 'yellow');
            return;
        }
        
        const diskNumber = infoMatch[1];
        const partitionNumber = infoMatch[2];
        
        srLog.log(`[i] [winstro::cleanup]: Found backup partition: Disk ${diskNumber}, Partition ${partitionNumber}`, 'blue');
        
        // Delete the partition and extend the main partition
        const psCleanup = `
            # Remove the backup partition
            Remove-Partition -DiskNumber ${diskNumber} -PartitionNumber ${partitionNumber} -Confirm:$false
            
            # Find the main partition (usually the largest remaining partition on the same disk)
            $mainPartition = Get-Partition -DiskNumber ${diskNumber} | 
                Where-Object { $_.Type -eq 'Basic' } | 
                Sort-Object Size -Descending | 
                Select-Object -First 1
            
            if ($mainPartition) {
                # Get maximum size for the partition
                $maxSize = (Get-PartitionSupportedSize -DiskNumber ${diskNumber} -PartitionNumber $mainPartition.PartitionNumber).SizeMax
                
                # Resize partition to maximum available size
                Resize-Partition -DiskNumber ${diskNumber} -PartitionNumber $mainPartition.PartitionNumber -Size $maxSize
                
                Write-Output "SUCCESS: Partition removed and drive expanded"
            } else {
                throw "Could not find main partition to expand"
            }
        `.trim();
        
        const encodedCleanup = Buffer.from(psCleanup, 'utf16le').toString('base64');
        const cleanupRes = await runProcess('smart_restore', 'powershell.exe', ['-NoProfile', '-EncodedCommand', encodedCleanup]);
        
        if (cleanupRes.code === 0 && (cleanupRes.stdout || '').includes('SUCCESS')) {
            srLog.log('[✓] [winstro::cleanup]: Backup partition removed and main drive expanded successfully!', 'green');
        } else {
            srLog.log('[⚠] [winstro::cleanup]: Partition cleanup completed with warnings', 'yellow');
        }
    } catch (err) {
        srLog.log(`[⚠] [winstro::cleanup]: Failed to remove partition and expand drive: ${err}`, 'yellow');
        srLog.log('[i] [winstro::cleanup]: You may need to manually remove the backup partition using Disk Management', 'blue');
    }
}


export default smart_restore;