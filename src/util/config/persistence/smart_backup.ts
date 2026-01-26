import * as fs from 'fs';
import * as path from 'path';
import commonAppConfigDirs from './config_dirs';
import { createTaskLogger } from '../../logging';
import { run as runProcess } from '../../run';
import colors from '../../colors';

const sbLog = createTaskLogger('smart_backup');

interface DiskInfo {
    diskNumber: number;
    totalSize: number;
    freeSpace: number;
    friendlyName: string;
}

/**
 * Check if the current process is running with administrator privileges
 */
async function isAdmin(): Promise<boolean> {
    try {
        const psCommand = `
            $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
            $principal = New-Object Security.Principal.WindowsPrincipal($identity)
            $isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
            Write-Output $isAdmin
        `.trim();
        
        const encodedCommand = Buffer.from(psCommand, 'utf16le').toString('base64');
        const res = await runProcess('smart_backup', 'powershell.exe', ['-NoProfile', '-EncodedCommand', encodedCommand]);
        
        // Extract the last line which should be True or False
        const lines = res.stdout.trim().split('\n');
        const result = lines[lines.length - 1].trim();
        return result === 'True';
    } catch (err) {
        sbLog.log(`[⚠] [winstro::smart_backup]: Error checking admin status: ${err}`, 'yellow');
        return false;
    }
}

interface RecentBackup {
    path: string;
    timestamp: Date;
    ageHours: number;
}

/**
 * Find the most recent backup within the specified number of hours
 * @param backupDir Directory to search for backups
 * @param maxAgeHours Maximum age in hours (default: 12)
 * @returns Recent backup info if found, null otherwise
 */
function findRecentBackup(backupDir: string, maxAgeHours: number = 12): RecentBackup | null {
    try {
        if (!fs.existsSync(backupDir)) {
            return null;
        }

        const files = fs.readdirSync(backupDir);
        const backupFiles = files.filter(f => f.startsWith('winstro-backup-') && f.endsWith('.tar.gz'));

        if (backupFiles.length === 0) {
            return null;
        }

        const now = new Date();
        let mostRecent: RecentBackup | null = null;

        for (const file of backupFiles) {
            try {
                // Extract timestamp from filename: winstro-backup-2026-01-26T04-21-30-509Z.tar.gz
                const timestampMatch = file.match(/winstro-backup-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.tar\.gz/);
                if (!timestampMatch) continue;

                // Convert to ISO format: 2026-01-26T04-21-30-509Z -> 2026-01-26T04:21:30.509Z
                const fileTimestamp = timestampMatch[1];
                const isoTimestamp = fileTimestamp
                    .replace(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, '$1T$2:$3:$4.$5Z');

                const backupDate = new Date(isoTimestamp);
                const ageMs = now.getTime() - backupDate.getTime();
                const ageHours = ageMs / (1000 * 60 * 60);

                if (ageHours <= maxAgeHours) {
                    if (!mostRecent || backupDate > mostRecent.timestamp) {
                        mostRecent = {
                            path: path.join(backupDir, file),
                            timestamp: backupDate,
                            ageHours: ageHours
                        };
                    }
                }
            } catch (err) {
                // Skip files with invalid timestamps
                continue;
            }
        }

        return mostRecent;
    } catch (err) {
        sbLog.log(`[⚠] [winstro::smart_backup]: Error checking for recent backups: ${err}`, 'yellow');
        return null;
    }
}

async function smart_backup(backupFilePath?: string): Promise<void> {
    try {
        sbLog.log(`[✓] [winstro::smart_backup]: Starting backup process...`, 'green');
        
        // Check for administrator privileges
        sbLog.log(`[i] [winstro::smart_backup]: Checking administrator privileges...`, 'blue');
        const hasAdmin = await isAdmin();
        if (!hasAdmin) {
            sbLog.log(`[✗] [winstro::smart_backup]: Administrator privileges required`, 'red');
            console.log(colors.red('\n✗ This operation requires administrator privileges.'));
            console.log(colors.yellow('Please run this command in an elevated PowerShell/Terminal window.\n'));
            throw new Error('Administrator privileges required');
        }
        sbLog.log(`[✓] [winstro::smart_backup]: Running with administrator privileges`, 'green');
        
        // Step 0: Check for recent backups (within 12 hours)
        const defaultBackupDir = path.join(process.env.LOCALAPPDATA || '', 'winstro', 'backups');
        const actualBackupDir = backupFilePath || defaultBackupDir;
        
        sbLog.log(`[i] [winstro::smart_backup]: Checking for recent backups...`, 'blue');
        const recentBackup = findRecentBackup(actualBackupDir, 12);
        
        let generatedBackupPath: string;
        if (recentBackup) {
            const ageMinutes = Math.floor(recentBackup.ageHours * 60);
            const ageDisplay = ageMinutes < 60 
                ? `${ageMinutes} minute(s)`
                : `${recentBackup.ageHours.toFixed(1)} hour(s)`;
            
            sbLog.log(`[✓] [winstro::smart_backup]: Found recent backup (${ageDisplay} old)`, 'green');
            sbLog.log(`[i] [winstro::smart_backup]: Using existing backup: ${recentBackup.path}`, 'blue');
            console.log(colors.blue(`\n[i] Using recent backup from ${ageDisplay} ago`));
            console.log(`Location: ${recentBackup.path}\n`);
            
            generatedBackupPath = recentBackup.path;
        } else {
            // Step 1: Create the backup
            sbLog.log(`[✓] [winstro::smart_backup]: No recent backup found, creating new backup...`, 'green');
            generatedBackupPath = await backup_configs(backupFilePath);
            sbLog.log(`[✓] [winstro::smart_backup]: Config backup created: ${generatedBackupPath}`, 'green');
        }
        
        // Step 2: Get backup file size
        sbLog.log('[✓] [winstro::smart_backup]: Calculating backup size...', 'green');
        const backupSize = fs.statSync(generatedBackupPath).size;
        const backupSizeMB = backupSize / 1024 / 1024;
        const backupSizeGB = backupSizeMB / 1024;
        sbLog.log(`[✓] [winstro::smart_backup]: Backup size: ${backupSizeGB.toFixed(2)} GB (${backupSizeMB.toFixed(2)} MB)`, 'green');

        // Step 3: Find main disk
        sbLog.log('[✓] [winstro::smart_backup]: Finding main disk...', 'green');
        const mainDisk = await findMainDisk();
        sbLog.log(`[✓] [winstro::smart_backup]: Main disk found: ${mainDisk.friendlyName} (Disk ${mainDisk.diskNumber})`, 'green');
        sbLog.log(`[i] [winstro::smart_backup]: Total: ${(mainDisk.totalSize / 1024 / 1024 / 1024).toFixed(2)} GB, Free: ${(mainDisk.freeSpace / 1024 / 1024 / 1024).toFixed(2)} GB`, 'blue');

        // Step 4: Check if there's enough space (with 20% buffer)
        const requiredSpace = backupSize * 1.2;
        if (mainDisk.freeSpace < requiredSpace) {
            sbLog.log(`[✗] [winstro::smart_backup]: Not enough free space. Required: ${(requiredSpace / 1024 / 1024 / 1024).toFixed(2)} GB, Available: ${(mainDisk.freeSpace / 1024 / 1024 / 1024).toFixed(2)} GB`, 'red');
            throw new Error('Insufficient disk space for partition creation');
        }

        // Step 5: Find available drive letter
        sbLog.log('[✓] [winstro::smart_backup]: Finding available drive letter...', 'green');
        const driveLetter = await findAvailableDriveLetter();
        sbLog.log(`[✓] [winstro::smart_backup]: Drive letter available: ${driveLetter}:`, 'green');

        // Step 6: Create partition (add 100MB for filesystem overhead)
        const partitionSize = backupSize + (100 * 1024 * 1024);
        sbLog.log(`[✓] [winstro::smart_backup]: Creating partition on Disk ${mainDisk.diskNumber}...`, 'green');
        await createPartition(mainDisk.diskNumber, partitionSize, driveLetter);
        sbLog.log(`[✓] [winstro::smart_backup]: Partition created: ${driveLetter}:`, 'green');

        // Step 7: Format partition
        sbLog.log(`[✓] [winstro::smart_backup]: Formatting partition as NTFS...`, 'green');
        await formatPartition(driveLetter, 'winstro-backup');
        sbLog.log(`[✓] [winstro::smart_backup]: Partition formatted and labeled: winstro-backup`, 'green');

        // Step 8: Move backup to partition
        sbLog.log(`[✓] [winstro::smart_backup]: Moving backup to ${driveLetter}:\\...`, 'green');
        const fileName = path.basename(generatedBackupPath);
        const newBackupPath = path.join(`${driveLetter}:\\`, fileName);
        await moveFile(generatedBackupPath, newBackupPath);
        sbLog.log(`[✓] [winstro::smart_backup]: Backup moved to ${newBackupPath}`, 'green');

        // Success summary
        console.log(`\n${colors.green('[✓] [winstro::smart_backup]:')} Backup partition created successfully!`);
        console.log(`Drive Letter: ${driveLetter}:`);
        console.log(`Label: winstro-backup`);
        console.log(`Format: NTFS`);
        console.log(`Backup Location: ${newBackupPath}`);
        console.log(`Backup Size: ${backupSizeMB.toFixed(2)} MB\n`);
        
        sbLog.log(`[✓] [winstro::smart_backup]: All operations completed successfully!`, 'green');
        
    } catch (err) {
        sbLog.log(`[✗] [winstro::smart_backup]: Operation failed: ${err}`, 'red');
        console.log(colors.red(`\n✗ Backup failed: ${err}\n`));
        throw err;
    } finally {
        // Exit successfully when done
        process.exit(0);
    }
}

async function findMainDisk(): Promise<DiskInfo> {
    try {
        const psCommand = `
            $disk = Get-Disk | Where-Object { $_.BusType -ne 'USB' -and $_.OperationalStatus -eq 'Online' } | Select-Object -First 1
            if ($disk) {
                # Get the first partition with a drive letter (typically C:)
                $partition = Get-Partition -DiskNumber $disk.Number | Where-Object { $_.DriveLetter -ne $null } | Select-Object -First 1
                
                if ($partition) {
                    # Get the volume to access free space
                    $volume = Get-Volume -DriveLetter $partition.DriveLetter
                    
                    @{
                        DiskNumber = $disk.Number
                        TotalSize = [long]$volume.Size
                        FreeSpace = [long]$volume.SizeRemaining
                        FriendlyName = $disk.FriendlyName
                        DriveLetter = $partition.DriveLetter
                    } | ConvertTo-Json -Compress
                } else {
                    throw "No partition with drive letter found on disk"
                }
            } else {
                throw "No suitable disk found"
            }
        `.trim();
        
        // Encode command as base64 to avoid shell escaping issues
        const encodedCommand = Buffer.from(psCommand, 'utf16le').toString('base64');
        
        const res = await runProcess('smart_backup', 'powershell.exe', ['-NoProfile', '-EncodedCommand', encodedCommand]);
        
        // Filter out CLIXML progress data and extract only the JSON line
        const lines = res.stdout.split('\n');
        const jsonLine = lines.find(line => line.trim().startsWith('{') && line.includes('"DiskNumber"'));
        if (!jsonLine) {
            throw new Error('Failed to parse disk information from PowerShell output');
        }
        const diskInfo = JSON.parse(jsonLine.trim());
        
        return {
            diskNumber: diskInfo.DiskNumber,
            totalSize: diskInfo.TotalSize,
            freeSpace: diskInfo.FreeSpace,
            friendlyName: diskInfo.FriendlyName,
        };
    } catch (err) {
        colors.yellow(`[⚠] [winstro::smart_backup]: Error finding disk: ${err}`);
        sbLog.log(`[⚠] [winstro::smart_backup]: Error finding disk: ${err}`, 'yellow');
        throw err;
    }
}

async function findAvailableDriveLetter(): Promise<string> {
    try {
        // Start with W: as preferred, then try others
        const preferredLetter = 'W';
        const psCommand = `
            $usedLetters = [System.IO.DriveInfo]::GetDrives() | ForEach-Object { $_.Name[0] }
            @{
                Preferred = '${preferredLetter}'
                UsedLetters = $usedLetters
            } | ConvertTo-Json -Compress
        `.trim();
        
        const encodedCommand = Buffer.from(psCommand, 'utf16le').toString('base64');
        const res = await runProcess('smart_backup', 'powershell.exe', ['-NoProfile', '-EncodedCommand', encodedCommand]);
        
        // Filter out CLIXML and extract JSON
        const lines = res.stdout.split('\n');
        const jsonLine = lines.find(line => line.trim().startsWith('{') && line.includes('"Preferred"'));
        if (!jsonLine) {
            throw new Error('Failed to parse drive letter information');
        }
        const driveInfo = JSON.parse(jsonLine.trim());
        const usedLetters = driveInfo.UsedLetters || [];

        // Check if W: is available
        if (!usedLetters.includes(preferredLetter)) {
            return preferredLetter;
        }

        // Find next available letter
        for (let i = 90; i >= 65; i--) { // Z to A
            const letter = String.fromCharCode(i);
            if (!usedLetters.includes(letter)) {
                return letter;
            }
        }

        throw new Error('No available drive letters');
    } catch (err) {
        sbLog.log(`[⚠] [winstro::smart_backup]: Error finding drive letter: ${err}`, 'yellow');
        throw err;
    }
}

async function shrinkPartition(driveLetter: string, requiredSizeInBytes: number): Promise<void> {
    try {
        // Convert bytes to MB for PowerShell
        const requiredSizeMB = Math.ceil(requiredSizeInBytes / (1024 * 1024));
        
        const psCommand = `
            $partition = Get-Partition -DriveLetter ${driveLetter}
            $volume = Get-Volume -DriveLetter ${driveLetter}
            
            # Get maximum shrink size
            $maxShrink = (Get-PartitionSupportedSize -DriveLetter ${driveLetter}).SizeMin
            $currentSize = $partition.Size
            $availableShrink = $currentSize - $maxShrink
            $availableShrinkMB = [math]::Floor($availableShrink / 1MB)
            
            $requiredMB = ${requiredSizeMB}
            
            if ($availableShrinkMB -lt $requiredMB) {
                throw "Cannot shrink partition. Available: $availableShrinkMB MB, Required: $requiredMB MB"
            }
            
            # Shrink the partition
            $newSize = $currentSize - ($requiredMB * 1MB)
            Resize-Partition -DriveLetter ${driveLetter} -Size $newSize
            
            Write-Output "Partition shrunk successfully by $requiredMB MB"
        `.trim();
        
        const encodedCommand = Buffer.from(psCommand, 'utf16le').toString('base64');
        const res = await runProcess('smart_backup', 'powershell.exe', ['-NoProfile', '-EncodedCommand', encodedCommand]);
        
        if (res.code !== 0) {
            const lines = res.stdout.split('\n');
            const errorLine = lines.find(line => line.includes('Exception') || line.includes('throw') || line.includes('Cannot shrink'));
            let errorMsg = 'Failed to shrink partition';
            if (errorLine) {
                const match = errorLine.match(/throw "(.+?)"/);  
                if (match) {
                    errorMsg = match[1];
                } else if (errorLine.includes('Cannot shrink')) {
                    errorMsg = errorLine.replace(/<[^>]+>/g, '').replace('throw', '').replace(/['"]/g, '').trim();
                }
            }
            throw new Error(errorMsg);
        }
        
        sbLog.log(`[✓] [winstro::smart_backup]: Successfully shrunk partition by ${requiredSizeMB} MB`, 'green');
    } catch (err) {
        sbLog.log(`[⚠] [winstro::smart_backup]: Error shrinking partition: ${err}`, 'yellow');
        throw err;
    }
}

async function createPartition(diskNumber: number, sizeInBytes: number, driveLetter: string): Promise<void> {
    try {
        // First, try to shrink the C: drive to make room for the new partition
        sbLog.log(`[i] [winstro::smart_backup]: Shrinking C: drive to make room for backup partition...`, 'blue');
        await shrinkPartition('C', sizeInBytes);
        
        const psCommand = `
            $partition = New-Partition -DiskNumber ${diskNumber} -Size ${sizeInBytes} -DriveLetter '${driveLetter}'
            if ($partition) {
                $partition | Select-Object DriveLetter, Size | ConvertTo-Json -Compress
            } else {
                throw "Failed to create partition"
            }
        `.trim();
        
        const encodedCommand = Buffer.from(psCommand, 'utf16le').toString('base64');
        const res = await runProcess('smart_backup', 'powershell.exe', ['-NoProfile', '-EncodedCommand', encodedCommand]);
        if (res.code !== 0) {
            // Extract error message from stderr/stdout
            const lines = res.stdout.split('\n');
            const errorLine = lines.find(line => line.includes('New-Partition :') || line.includes('Exception') || line.includes('Error'));
            let errorMsg = 'Unknown error';
            if (errorLine) {
                const match = errorLine.match(/New-Partition : (.+?)_x000D_/);
                if (match) {
                    errorMsg = match[1];
                } else {
                    errorMsg = errorLine.replace(/<[^>]+>/g, '').trim();
                }
            }
            throw new Error(`CreatePartition failed: ${errorMsg}`);
        }
    } catch (err) {
        sbLog.log(`[⚠] [winstro::smart_backup]: Error creating partition: ${err}`, 'yellow');
        throw err;
    }
}

async function formatPartition(driveLetter: string, volumeLabel: string): Promise<void> {
    try {
        const psCommand = `
            $result = Format-Volume -DriveLetter ${driveLetter} -FileSystem NTFS -NewFileSystemLabel "${volumeLabel}" -Confirm:$false -Force
            if ($result) {
                Write-Output "Volume formatted successfully"
            } else {
                throw "Failed to format volume"
            }
        `.trim();
        
        const encodedCommand = Buffer.from(psCommand, 'utf16le').toString('base64');
        const res = await runProcess('smart_backup', 'powershell.exe', ['-NoProfile', '-EncodedCommand', encodedCommand]);
        if (res.code !== 0) {
            const errorLines = res.stdout.split('\n').filter(line => line.includes('Error') || line.includes('Exception'));
            const errorMsg = errorLines.length > 0 ? errorLines[0] : 'Unknown error';
            throw new Error(`FormatPartition failed: ${errorMsg}`);
        }
    } catch (err) {
        sbLog.log(`[⚠] [winstro::smart_backup]: Error formatting partition: ${err}`, 'yellow');
        throw err;
    }
}

async function moveFile(source: string, destination: string): Promise<void> {
    try {
        const psCommand = `
            if (Test-Path "${source}") {
                Move-Item -Path "${source}" -Destination "${destination}" -Force
                if (Test-Path "${destination}") {
                    Write-Output "File moved successfully"
                } else {
                    throw "File was not moved to destination"
                }
            } else {
                throw "Source file does not exist"
            }
        `.trim();
        
        const encodedCommand = Buffer.from(psCommand, 'utf16le').toString('base64');
        const res = await runProcess('smart_backup', 'powershell.exe', ['-NoProfile', '-EncodedCommand', encodedCommand]);
        if (res.code !== 0) {
            const errorLines = res.stdout.split('\n').filter(line => line.includes('Error') || line.includes('Exception'));
            const errorMsg = errorLines.length > 0 ? errorLines[0] : 'Unknown error';
            throw new Error(`MoveFile failed: ${errorMsg}`);
        }
    } catch (err) {
        sbLog.log(`[⚠] [winstro::smart_backup]: Error moving file: ${err}`, 'yellow');
        throw err;
    }
}

async function backup_configs(backup_path?: string): Promise<string> {
    const bcLog = createTaskLogger('backup_configs');
    try {
        bcLog.log('[✓] [winstro::backup_configs]: Starting configuration backup...', 'green');
        
        // Determine backup location
        const defaultBackupDir = path.join(process.env.LOCALAPPDATA || '', 'winstro', 'backups');
        const actualBackupDir = backup_path || defaultBackupDir;
        
        // Create backup directory if it doesn't exist
        if (!fs.existsSync(actualBackupDir)) {
            fs.mkdirSync(actualBackupDir, { recursive: true });
        }
        
        // Create timestamp for backup file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `winstro-backup-${timestamp}.tar.gz`;
        const backupFilePath = path.join(actualBackupDir, backupFileName);
        
        // Create a temporary directory for staging config files
        const tempDir = path.join(process.env.LOCALAPPDATA || '', 'winstro', 'temp', 'backup');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Copy all config directories to temp directory
        bcLog.log('[✓] [winstro::backup_configs]: Copying configuration directories...', 'green');
        let copiedCount = 0;
        for (const configDir of commonAppConfigDirs) {
            const expandedPath = expandEnvVars(configDir);
            if (fs.existsSync(expandedPath)) {
                const destName = configDir.replace(/[%\\:]/g, '_');
                const destPath = path.join(tempDir, destName);
                try {
                    copyDirSync(expandedPath, destPath);
                    copiedCount++;
                } catch (err) {
                    colors.yellow(`[⚠] [winstro::backup_configs]: Failed to copy ${configDir}: ${err}`);
                }
            }
        }
        
        bcLog.log(`[✓] [winstro::backup_configs]: Copied ${copiedCount} configuration directories`, 'green');
        
        // Create a metadata file with the mapping
        const metadata = {
            timestamp: new Date().toISOString(),
            dirs: commonAppConfigDirs,
            copiedDirs: copiedCount,
        };
        fs.writeFileSync(path.join(tempDir, '_backup_metadata.json'), JSON.stringify(metadata, null, 2));
        
        // Compress to tar.gz
        bcLog.log('[✓] [winstro::backup_configs]: Compressing backup (this may take a minute)...', 'green');
        const finalFilePath = await compressDirectory(tempDir, backupFilePath);
        
        // Clean up temp directory
        bcLog.log('[✓] [winstro::backup_configs]: Cleaning up temporary files...', 'green');
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        bcLog.log(`[✓] [winstro::backup_configs]: Backup complete! Saved to: ${finalFilePath}`, 'green');
        const fileSizeMB = (fs.statSync(finalFilePath).size / 1024 / 1024).toFixed(2);
        console.log(colors.green(`\nBackup created successfully!`));
        console.log(`Location: ${finalFilePath}`);
        console.log(`Size: ${fileSizeMB} MB\n`);
        bcLog.log(`Size: ${fileSizeMB} MB`, 'green');
        
        return finalFilePath;
    } catch (err) {
        bcLog.log(`[✗] [winstro::backup_configs]: Backup failed: ${err}`, 'red');
        throw err;
    }
}

function expandEnvVars(str: string): string {
    return str.replace(/%USERPROFILE%/g, process.env.USERPROFILE || '')
              .replace(/%APPDATA%/g, process.env.APPDATA || '')
              .replace(/%LOCALAPPDATA%/g, process.env.LOCALAPPDATA || '');
}

function copyDirSync(src: string, dest: string, depth: number = 0): void {
    // Limit recursion depth to avoid issues with deep/symlinked directories
    if (depth > 10) return;
    
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    try {
        const files = fs.readdirSync(src);
        for (const file of files) {
            try {
                const srcPath = path.join(src, file);
                const destPath = path.join(dest, file);
                
                const stat = fs.lstatSync(srcPath);
                
                // Skip symbolic links to avoid circular references
                if (stat.isSymbolicLink()) continue;
                
                if (stat.isDirectory()) {
                    copyDirSync(srcPath, destPath, depth + 1);
                } else {
                    fs.copyFileSync(srcPath, destPath);
                }
            } catch (fileErr) {
                // Skip individual files that can't be copied (locked, permissions, etc.)
                continue;
            }
        }
    } catch (dirErr) {
        // If we can't read the directory at all, just skip it
        return;
    }
}

async function compressDirectory(sourceDir: string, outputFile: string): Promise<string> {
    // Use tar package for compression
    const tar = await import('tar');
    
    // Ensure we're using .tar.gz extension  
    const tarFile = outputFile.replace('.zip', '.tar.gz');
    
    sbLog.log('[i] Starting tar compression...', 'blue');
    
    // Compress with better error handling
    // Get all files and directories from sourceDir to include in the archive
    const files = fs.readdirSync(sourceDir);
    sbLog.log(`[i] Files to compress: ${files.join(', ')}`, 'blue');
    
    try {
        await tar.c(
            {
                gzip: true,
                file: tarFile,
                portable: true,
                preservePaths: false,
                cwd: sourceDir  // Change directory to source, so paths are relative
            },
            files  // Include all files/directories in the source
        );
        
        sbLog.log(`[✓] Compression complete`, 'green');
    } catch (err) {
        sbLog.log(`[✗] Compression error: ${err}`, 'red');
        throw err;
    }
    
    return tarFile;
}

export default smart_backup;