const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getAdminStatus: () => ipcRenderer.invoke('get-admin-status'),
    restartAsAdmin: () => ipcRenderer.invoke('restart-as-admin'),
    getPackageIcon: (pkgId) => ipcRenderer.invoke('get-package-icon', pkgId),
    readPackages: (role) => ipcRenderer.invoke('read-packages', role),
    checkChoco: () => ipcRenderer.invoke('check-choco'),
    installChoco: () => ipcRenderer.invoke('install-choco'),
    installPackages: (packages) => ipcRenderer.send('install-packages', packages),
    onInstallProgress: (callback) => ipcRenderer.on('install-progress', (event, data) => callback(data)),
    onInstallLog: (callback) => ipcRenderer.on('install-log', (event, data) => callback(data)),
    onInstallComplete: (callback) => ipcRenderer.on('install-complete', () => callback()),
    abortInstall: () => ipcRenderer.send('abort-install'),
});
