const screens = {
    role: document.getElementById('role-selection'),
    packages: document.getElementById('package-selection'),
    progress: document.getElementById('progress-screen'),
    admin: document.getElementById('admin-warning'),
    finish: document.getElementById('finish-screen')
};

const elements = {
    packageList: document.getElementById('package-list'),
    roleTitle: document.getElementById('selected-role-title'),
    startBtn: document.getElementById('start-install'),
    backBtn: document.getElementById('back-to-roles-header'),
    abortBtn: document.getElementById('abort-install'),
    backToSelectionBtn: document.getElementById('back-to-selection'),
    progressBar: document.getElementById('progress-bar'),
    currentPkg: document.getElementById('current-package'),
    log: document.getElementById('install-log'),
    logContainer: document.getElementById('log-container'),
    closeBtn: document.getElementById('close-app'),
    status: document.getElementById('app-status'),
    packageCount: document.getElementById('package-count'),
    selectAllBtn: document.getElementById('select-all'),
    deselectAllBtn: document.getElementById('deselect-all')
};

let selectedPackages = [];
let allAvailablePackages = [];

// Screen Navigation
function showScreen(screenId) {
    Object.values(screens).forEach(screen => {
        if (screen) screen.classList.remove('active');
    });
    if (screens[screenId]) screens[screenId].classList.add('active');

    // Toggle header button visibility
    elements.backBtn.style.visibility = (screenId === 'packages') ? 'visible' : 'hidden';
}

// Role Selection
document.querySelectorAll('.role-card').forEach(card => {
    card.addEventListener('click', async () => {
        const role = card.dataset.role;
        const roleName = card.querySelector('h3').innerText;
        elements.roleTitle.innerText = roleName;
        
        showScreen('packages');
        elements.status.innerText = `Loading ${roleName}...`;

        const categories = await window.api.readPackages(role);
        renderPackageList(categories);
        elements.status.innerText = `${roleName} Ready`;
    });
});

function renderPackageList(categories) {
    elements.packageList.innerHTML = '';
    selectedPackages = [];
    allAvailablePackages = [];

    categories.forEach(cat => {
        const catHeader = document.createElement('div');
        catHeader.className = 'category-header';
        catHeader.innerText = cat.name;
        elements.packageList.appendChild(catHeader);

        cat.packages.forEach(pkg => {
            selectedPackages.push(pkg);
            allAvailablePackages.push(pkg);
            
            const item = document.createElement('div');
            item.className = 'package-item selected';
            
            // Icon
            const iconImg = document.createElement('img');
            iconImg.className = 'pkg-icon';
            iconImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            iconImg.alt = '';
            
            window.api.getPackageIcon(pkg).then(url => {
                if (url) iconImg.src = url;
            });

            // Label
            const label = document.createElement('span');
            label.className = 'pkg-name';
            label.innerText = pkg;

            item.appendChild(iconImg);
            item.appendChild(label);

            item.addEventListener('click', () => {
                if (selectedPackages.includes(pkg)) {
                    selectedPackages = selectedPackages.filter(p => p !== pkg);
                    item.classList.remove('selected');
                } else {
                    selectedPackages.push(pkg);
                    item.classList.add('selected');
                }
                updatePackageCount();
            });

            elements.packageList.appendChild(item);
        });
    });
    updatePackageCount();
}

function updatePackageCount() {
    elements.packageCount.innerText = selectedPackages.length;
}

elements.backBtn.addEventListener('click', () => {
    showScreen('role');
    elements.status.innerText = 'Ready';
});

// Installation Process
elements.startBtn.addEventListener('click', async () => {
    if (selectedPackages.length === 0) {
        alert('Please select at least one package.');
        return;
    }

    showScreen('progress');
    elements.status.innerText = 'Installing...';
    elements.log.innerText = '';

    const chocoStatus = await window.api.checkChoco();
    
    if (!chocoStatus.installed) {
        elements.currentPkg.innerText = 'Installing Chocolatey...';
        elements.log.innerText += 'Chocolatey not found. Installing...\n';
        const success = await window.api.installChoco();
        if (!success) {
            elements.log.innerText += 'ERROR: Failed to install Chocolatey.\n';
            elements.currentPkg.innerText = 'Installation failed.';
            return;
        }
    }

    window.api.installPackages(selectedPackages);
});

document.getElementById('abort-install').addEventListener('click', () => {
    window.api.abortInstall();
    elements.status.innerText = 'Aborting...';
});

elements.backToSelectionBtn.addEventListener('click', () => {
    showScreen('packages');
    elements.status.innerText = 'Ready';
    // Reset buttons for next time
    elements.abortBtn.style.display = 'block';
    elements.backToSelectionBtn.style.display = 'none';
});

// Bulk Selection
elements.selectAllBtn.addEventListener('click', () => {
    selectedPackages = [...allAvailablePackages];
    document.querySelectorAll('.package-item').forEach(item => {
        item.classList.add('selected');
    });
    updatePackageCount();
});

elements.deselectAllBtn.addEventListener('click', () => {
    selectedPackages = [];
    document.querySelectorAll('.package-item').forEach(item => {
        item.classList.remove('selected');
    });
    updatePackageCount();
});

function scrollToBottom() {
    elements.logContainer.scrollTop = elements.logContainer.scrollHeight;
}

// IPC Listeners
window.api.onInstallProgress((data) => {
    const { pkg, status, detail } = data;
    
    if (status === 'Failed' && pkg === 'Aborted') {
        elements.abortBtn.style.display = 'none';
        elements.backToSelectionBtn.style.display = 'block';
        elements.currentPkg.innerText = 'Installation Cancelled';
        elements.status.innerText = 'Aborted';
        return;
    }

    elements.currentPkg.innerText = `Installing: ${pkg}...`;
    if (detail) elements.log.innerText += `> [${pkg}] ${detail}\n`;
    
    const total = selectedPackages.length;
    const current = selectedPackages.indexOf(pkg) + (status === 'Success' || status === 'Failed' ? 1 : 0.5);
    const percent = Math.min((current / total) * 100, 100);
    elements.progressBar.style.width = `${percent}%`;
    scrollToBottom();
});

window.api.onInstallLog((log) => {
    elements.log.innerText += log;
    scrollToBottom();
});

window.api.onInstallComplete(() => {
    elements.status.innerText = 'Complete';
    elements.progressBar.style.width = '100%';
    
    const successMsg = document.getElementById('success-message');
    if (successMsg) {
        successMsg.innerText = `${selectedPackages.length} applications have been processed successfully.`;
    }
    
    setTimeout(() => showScreen('finish'), 1000);
});

elements.closeBtn.addEventListener('click', () => window.close());

document.getElementById('bypass-admin').addEventListener('click', () => {
    showScreen('role');
    elements.status.innerText = 'Ready (User)';
});

document.getElementById('restart-admin-btn').addEventListener('click', async () => {
    elements.status.innerText = 'Elevating...';
    await window.api.restartAsAdmin();
});

// Initial Admin Check
async function init() {
    elements.backBtn.style.visibility = 'hidden';
    const isAdmin = await window.api.getAdminStatus();
    if (!isAdmin) {
        showScreen('admin');
        elements.status.innerText = '🛡️ Elevation';
    }
}

init();
