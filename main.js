const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const isDryRun = process.argv.includes('--dry-run');
if (isDryRun) {
    console.log('🚀 DRY RUN MODE ACTIVE - Installations will be simulated.');
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1150,
        height: 850,
        minWidth: 900,
        minHeight: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        autoHideMenuBar: true,
        backgroundColor: '#0f172a', // Sleek dark blue
    });

    win.loadFile('src/index.html');
}

async function prefetchIcons() {
    initIconCache();
    const dataDir = path.join(__dirname, 'data');
    try {
        const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.txt'));
        const allPackages = new Set();

        for (const file of files) {
            const content = fs.readFileSync(path.join(dataDir, file), 'utf8');
            const lines = content.split('\n');
            lines.forEach(line => {
                const pkg = line.trim();
                if (pkg && !pkg.startsWith('#')) {
                    allPackages.add(pkg);
                }
            });
        }

        console.log(`[Prefetch] Warming up icons for ${allPackages.size} unique packages...`);
        for (const pkg of allPackages) {
            if (!iconCache[pkg]) {
                // Fetch in background, one by one to avoid spamming
                await fetchIcon(pkg);
            }
        }
        console.log(`[Prefetch] All icons ready.`);
    } catch (e) {
        console.error("Prefetch failed", e);
    }
}

// Helper to fetch icon without IPC context
async function fetchIcon(pkgId) {
    try {
        const url = `https://community.chocolatey.org/packages/${pkgId}`;
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!response.ok) return;
        const html = await response.text();
        
        let iconUrl = null;
        const nuspecMatch = html.match(/Nuspec reference:\s*&lt;iconUrl&gt;([^&"|]+)/i) || 
                            html.match(/Nuspec reference:\s*<iconUrl>([^<|]+)/i);
        if (nuspecMatch) iconUrl = nuspecMatch[1].trim();
        
        if (!iconUrl) {
            const iconDivMatch = html.match(/class="[^"]*package-icon[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
            if (iconDivMatch) {
                const imgMatch = iconDivMatch[1].match(/src="([^"]+)"/i);
                if (imgMatch) iconUrl = imgMatch[1];
            }
        }

        if (iconUrl) {
            if (iconUrl.startsWith('//')) iconUrl = 'https:' + iconUrl;
            if (iconUrl.startsWith('/')) iconUrl = 'https://community.chocolatey.org' + iconUrl;
            iconCache[pkgId] = iconUrl;
            saveIconCache();
        }
    } catch (e) {
        // Silent failure
    }
}

app.whenReady().then(() => {
    createWindow();
    prefetchIcons(); // Start prefetching in background

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('get-admin-status', async () => {
    return new Promise((resolve) => {
        exec('net session', (error) => {
            resolve(!error);
        });
    });
});

ipcMain.handle('restart-as-admin', async () => {
    const args = process.argv.slice(1).map(arg => `"${arg}"`).join(' ');
    const execPath = process.execPath;
    const psCommand = `Start-Process -FilePath "${execPath}" -ArgumentList ${args} -Verb RunAs`;
    
    return new Promise((resolve) => {
        exec(`powershell -Command "${psCommand}"`, (error) => {
            if (!error) {
                app.quit();
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
});

// Icon Cache
let iconCache = null;
let iconCachePath = null;

function initIconCache() {
    if (iconCache) return;
    try {
        iconCachePath = path.join(app.getPath('userData'), 'icons.json');
        if (fs.existsSync(iconCachePath)) {
            iconCache = JSON.parse(fs.readFileSync(iconCachePath, 'utf8'));
        } else {
            iconCache = {};
        }
    } catch (e) {
        iconCache = {};
    }
}

function saveIconCache() {
    if (!iconCachePath || !iconCache) return;
    try {
        fs.writeFileSync(iconCachePath, JSON.stringify(iconCache, null, 2));
    } catch (e) {
        console.error("Failed to save icon cache", e);
    }
}

ipcMain.handle('get-package-icon', async (event, pkgId) => {
    initIconCache();
    if (iconCache[pkgId]) return iconCache[pkgId];

    try {
        const url = `https://community.chocolatey.org/packages/${pkgId}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html'
            }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const html = await response.text();
        let iconUrl = null;
        
        // 1. Try finding the raw Nuspec iconUrl reference in the title attribute
        const nuspecMatch = html.match(/Nuspec reference:\s*&lt;iconUrl&gt;([^&"|]+)/i) || 
                            html.match(/Nuspec reference:\s*<iconUrl>([^<|]+)/i);
        if (nuspecMatch) iconUrl = nuspecMatch[1].trim();

        // 2. Try finding the official package-icon div (flexible match)
        if (!iconUrl) {
            const iconDivMatch = html.match(/class="[^"]*package-icon[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
            if (iconDivMatch) {
                const imgMatch = iconDivMatch[1].match(/src="([^"]+)"/i);
                if (imgMatch) iconUrl = imgMatch[1];
            }
        }

        // 3. Try finding by alt text (order-independent)
        if (!iconUrl) {
            const altMatch = html.match(/<img[^>]*alt="Icon for package [^"]+"[^>]*src="([^"]+)"/i) ||
                             html.match(/<img[^>]*src="([^"]+)"[^>]*alt="Icon for package [^"]+"/i);
            if (altMatch) iconUrl = altMatch[1];
        }

        // 4. Try any image that looks like a package icon
        if (!iconUrl) {
            const genericMatch = html.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*package[^"]*"/i) ||
                                 html.match(/<img[^>]*class="[^"]*package[^"]*"[^>]*src="([^"]+)"/i);
            if (genericMatch) iconUrl = genericMatch[1];
        }
        
        if (iconUrl) {
            if (iconUrl.startsWith('//')) iconUrl = 'https:' + iconUrl;
            if (iconUrl.startsWith('/')) iconUrl = 'https://community.chocolatey.org' + iconUrl;
            
            // Save to cache
            iconCache[pkgId] = iconUrl;
            saveIconCache();
            return iconUrl;
        }

        return 'https://community.chocolatey.org/Content/Images/packageDefaultIcon.png';
    } catch (err) {
        return 'https://community.chocolatey.org/Content/Images/packageDefaultIcon.png';
    }
});

ipcMain.handle('read-packages', async (event, role) => {
    const filePath = path.join(__dirname, 'data', role + '.txt');
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const lines = data.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('//'));
        
        const categories = [];
        let currentCategory = { name: 'Default', packages: [] };
        
        lines.forEach(line => {
            if (line.startsWith('#')) {
                if (currentCategory.packages.length > 0) {
                    categories.push(currentCategory);
                }
                currentCategory = { name: line.replace('#', '').trim(), packages: [] };
            } else {
                currentCategory.packages.push(line);
            }
        });
        
        if (currentCategory.packages.length > 0) {
            categories.push(currentCategory);
        }
        
        return categories;
    } catch (err) {
        console.error('Error reading packages:', err);
        return [];
    }
});

ipcMain.handle('check-choco', async () => {
    if (isDryRun) return { installed: true, version: '1.0.0 (DRY RUN)' };
    return new Promise((resolve) => {
        exec('choco --version', (error, stdout, stderr) => {
            if (error) {
                resolve({ installed: false, version: null });
            } else {
                resolve({ installed: true, version: stdout.trim() });
            }
        });
    });
});

ipcMain.handle('install-choco', async () => {
    if (isDryRun) return true;
    return new Promise((resolve) => {
        const cmd = 'Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; Invoke-Expression ((New-Object System.Net.WebClient).DownloadString(\'https://chocolatey.org/install.ps1\'))';
        const ps = exec(`powershell -Command "${cmd}"`);
        
        ps.on('close', (code) => {
            resolve(code === 0);
        });
    });
});


let currentInstallProcess = null;
let abortRequested = false;

ipcMain.on('abort-install', () => {
    abortRequested = true;
    if (currentInstallProcess) {
        console.log('[Abort] Killing current installation process...');
        currentInstallProcess.kill();
    }
});

ipcMain.on('install-packages', async (event, packages) => {
    abortRequested = false;
    
    if (isDryRun) {
        for (const pkg of packages) {
            if (abortRequested) break;
            event.sender.send('install-progress', { pkg, status: 'Installing', detail: '(DRY RUN) Starting simulation...' });
            await new Promise(r => setTimeout(r, 800));
            if (abortRequested) break;
            event.sender.send('install-log', `[DRY RUN] choco install ${pkg} -y\n`);
            event.sender.send('install-log', `[DRY RUN] Simulation for ${pkg} successful.\n`);
            event.sender.send('install-progress', { pkg, status: 'Success', detail: 'Mock installation complete' });
            await new Promise(r => setTimeout(r, 400));
        }
        if (abortRequested) {
            event.sender.send('install-log', '\n[ABORT] Installation cancelled by user.\n');
            event.sender.send('install-progress', { pkg: 'Aborted', status: 'Failed', detail: 'User cancelled' });
        } else {
            event.sender.send('install-complete');
        }
        return;
    }

    // Real installation logic
    for (const pkg of packages) {
        if (abortRequested) break;
        event.sender.send('install-progress', { pkg, status: 'Installing' });
        
        currentInstallProcess = exec(`choco install ${pkg} -y`);
        
        currentInstallProcess.stdout.on('data', (data) => {
            event.sender.send('install-log', data.toString());
        });

        currentInstallProcess.stderr.on('data', (data) => {
            event.sender.send('install-log', `ERROR: ${data.toString()}`);
        });

        await new Promise((resolve) => {
            currentInstallProcess.on('close', (code) => {
                currentInstallProcess = null;
                event.sender.send('install-progress', { 
                    pkg, 
                    status: code === 0 ? 'Success' : 'Failed' 
                });
                resolve();
            });
        });
    }
    
    if (abortRequested) {
        event.sender.send('install-log', '\n[ABORT] Installation cancelled by user.\n');
    } else {
        event.sender.send('install-complete');
    }
});
