// ========================================
// EMPLOYEES PAGE HANDLER
// ========================================

// Vérifier si l'utilisateur est connecté avec authManager
if (!authManager.requireAuth()) {
    throw new Error('Non authentifié');
}

// Récupérer l'utilisateur via authManager
const empUser = authManager.getUser();

// URL de l'API Cloudflare Worker
const EMPLOYEES_API_URL = 'https://eagle-security.charliemoimeme.workers.dev/api';

// Variables globales avec préfixe pour éviter les conflits
let employeesData = [];
let employeesFiltered = [];
let employeesCurrentPage = 1;
let employeesPerPage = 10;
let employeesSort = { column: 'rank', direction: 'asc' };
let employeesFilters = {
    rank: '',
    hiredAfter: '',
    hiredBefore: '',
    login: ''
};

// ========================================
// INITIALISATION
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
    loadCurrentUserAvatar();
    await loadEmployeesData();
    initializeEmployeeListeners();
});

// ========================================
// CHARGER L'AVATAR UTILISATEUR NAVBAR
// ========================================

function loadCurrentUserAvatar() {
    const avatarEl = document.getElementById('user-avatar-nav');
    
    if (!avatarEl || !empUser.id) {
        return;
    }

    // Si on a déjà l'avatar_url dans empUser
    if (empUser.avatar_url) {
        avatarEl.innerHTML = `<img src="${empUser.avatar_url}" alt="${empUser.name}">`;
    } else {
        // Sinon, charger depuis l'API
        loadUserAvatarFromAPI();
    }
}

async function loadUserAvatarFromAPI() {
    try {
        const response = await authManager.fetch(`${EMPLOYEES_API_URL}/employees/${empUser.id}`);

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.employee) {
                const avatarEl = document.getElementById('user-avatar-nav');
                
                if (data.employee.avatar_url) {
                    avatarEl.innerHTML = `<img src="${data.employee.avatar_url}" alt="${data.employee.name}">`;
                    
                    // Mettre à jour le cache local
                    const user = authManager.getUser();
                    user.avatar_url = data.employee.avatar_url;
                    localStorage.setItem('eagle_user', JSON.stringify(user));
                } else {
                    // Afficher les initiales si pas d'avatar
                    const initials = empUser.name
                        .split(' ')
                        .map(word => word.charAt(0))
                        .join('')
                        .toUpperCase()
                        .substring(0, 2);
                    avatarEl.textContent = initials;
                }
            }
        }
    } catch (error) {
        console.error('Error loading user avatar:', error);
    }
}

// ========================================
// CHARGEMENT DES DONNÉES
// ========================================

async function loadEmployeesData() {
    try {
        const response = await authManager.fetch(`${EMPLOYEES_API_URL}/employees`);

        if (!response.ok) {
            throw new Error('Erreur lors du chargement des employés');
        }

        const data = await response.json();
        
        if (data.success) {
            employeesData = data.employees;
            employeesFiltered = [...employeesData];
            
            // Charger les grades pour les filtres
            await loadRanksData();
            
            // Trier et afficher
            sortEmployeesData();
            updateEmployeeStats();
            displayEmployeesTable();
            
            notify.success('Chargement réussi', `${employeesData.length} employés chargés`);
        } else {
            throw new Error(data.message || 'Erreur serveur');
        }
    } catch (error) {
        console.error('Error loading employees:', error);
        notify.error('Erreur', 'Impossible de charger la liste des employés');
        displayEmployeesEmpty();
    }
}

async function loadRanksData() {
    try {
        const response = await authManager.fetch(`${EMPLOYEES_API_URL}/ranks`);

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                populateEmployeeRankFilter(data.ranks);
            }
        }
    } catch (error) {
        console.error('Error loading ranks:', error);
    }
}

function populateEmployeeRankFilter(ranks) {
    const selectElement = document.getElementById('filter-rank');
    ranks.forEach(rank => {
        const option = document.createElement('option');
        option.value = rank.id;
        option.textContent = rank.name;
        selectElement.appendChild(option);
    });
}

// ========================================
// TRI DES DONNÉES
// ========================================

function sortEmployeesData() {
    employeesFiltered.sort((a, b) => {
        let aVal, bVal;

        switch (employeesSort.column) {
            case 'name':
                aVal = a.name.toLowerCase();
                bVal = b.name.toLowerCase();
                break;
            case 'badge':
                aVal = a.id;
                bVal = b.id;
                break;
            case 'rank':
                // Tri par hiérarchie puis par nom
                if (a.hierarchy !== b.hierarchy) {
                    aVal = a.hierarchy;
                    bVal = b.hierarchy;
                } else {
                    aVal = a.name.toLowerCase();
                    bVal = b.name.toLowerCase();
                    return aVal < bVal ? -1 : 1;
                }
                break;
            case 'email':
                aVal = a.email.toLowerCase();
                bVal = b.email.toLowerCase();
                break;
            case 'hired':
                aVal = new Date(a.hired_date || 0).getTime();
                bVal = new Date(b.hired_date || 0).getTime();
                break;
            case 'login':
                aVal = new Date(a.last_login || 0).getTime();
                bVal = new Date(b.last_login || 0).getTime();
                break;
            default:
                return 0;
        }

        if (employeesSort.direction === 'asc') {
            return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
            return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
    });
}

// ========================================
// AFFICHAGE DU TABLEAU
// ========================================

function displayEmployeesTable() {
    const tbody = document.getElementById('employees-tbody');
    
    // Calculer la pagination
    const startIndex = (employeesCurrentPage - 1) * employeesPerPage;
    const endIndex = startIndex + employeesPerPage;
    const pageEmployees = employeesFiltered.slice(startIndex, endIndex);

    if (pageEmployees.length === 0) {
        displayEmployeesEmpty();
        return;
    }

    // Générer les lignes
    tbody.innerHTML = pageEmployees.map(emp => {
        const initials = emp.name
            .split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .substring(0, 2);

        const badge = String(emp.id).padStart(4, '0');
        const hiredDate = formatEmployeeDate(emp.hired_date);
        const loginStatus = getEmployeeLoginStatus(emp.last_login);

        // Avatar (image ou initiales)
        const avatarContent = emp.avatar_url 
            ? `<img src="${emp.avatar_url}" alt="${emp.name}">`
            : initials;

        return `
            <tr data-employee-id="${emp.id}">
                <td>
                    <div class="employee-name">
                        ${emp.name}
                    </div>
                </td>
                <td>
                    <span class="employee-badge">#${badge}</span>
                </td>
                <td>
                    <span class="employee-rank rank-${emp.hierarchy}">${emp.rank_name || 'N/A'}</span>
                </td>
                <td>
                    <span class="employee-email">${emp.email}</span>
                </td>
                <td>
                    <span class="employee-date">${hiredDate}</span>
                </td>
                <td>
                    <div class="login-status">
                        <span class="status-indicator status-${loginStatus.status}"></span>
                        <span class="employee-date">${loginStatus.text}</span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Ajouter les événements de clic sur les lignes
    tbody.querySelectorAll('tr[data-employee-id]').forEach(row => {
        row.addEventListener('click', () => {
            const employeeId = row.getAttribute('data-employee-id');
            openEmployeeModal(employeeId);
        });
    });

    updateEmployeesPagination();
    updateEmployeesSortIndicators();
}

function displayEmployeesEmpty() {
    const tbody = document.getElementById('employees-tbody');
    tbody.innerHTML = `
        <tr class="empty-row">
            <td colspan="6">
                Aucun employé trouvé
            </td>
        </tr>
    `;
    updateEmployeesPagination();
}

// ========================================
// STATISTIQUES
// ========================================

function updateEmployeeStats() {
    // Total employés
    document.getElementById('total-employees').textContent = employeesData.length;
}

// ========================================
// RECHERCHE
// ========================================

function handleEmployeeSearch(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    
    if (!term) {
        employeesFiltered = [...employeesData];
    } else {
        employeesFiltered = employeesData.filter(emp => {
            const badge = String(emp.id).padStart(4, '0');
            return (
                emp.name.toLowerCase().includes(term) ||
                emp.email.toLowerCase().includes(term) ||
                badge.includes(term) ||
                (emp.rank_name && emp.rank_name.toLowerCase().includes(term))
            );
        });
    }

    applyEmployeeFilters();
    sortEmployeesData();
    employeesCurrentPage = 1;
    displayEmployeesTable();
}

// ========================================
// FILTRES
// ========================================

function applyEmployeeFilters() {
    let result = [...employeesFiltered];

    // Filtre par grade
    if (employeesFilters.rank) {
        result = result.filter(emp => emp.rank_id == employeesFilters.rank);
    }

    // Filtre date d'arrivée (après)
    if (employeesFilters.hiredAfter) {
        const afterDate = new Date(employeesFilters.hiredAfter);
        result = result.filter(emp => {
            const hiredDate = new Date(emp.hired_date);
            return hiredDate >= afterDate;
        });
    }

    // Filtre date d'arrivée (avant)
    if (employeesFilters.hiredBefore) {
        const beforeDate = new Date(employeesFilters.hiredBefore);
        result = result.filter(emp => {
            const hiredDate = new Date(emp.hired_date);
            return hiredDate <= beforeDate;
        });
    }

    // Filtre dernier login
    if (employeesFilters.login) {
        const now = new Date();
        
        result = result.filter(emp => {
            if (!emp.last_login && employeesFilters.login === 'never') {
                return true;
            }
            
            if (!emp.last_login) return false;
            
            const loginDate = new Date(emp.last_login);
            const daysDiff = Math.floor((now - loginDate) / (1000 * 60 * 60 * 24));

            switch (employeesFilters.login) {
                case 'today':
                    return daysDiff < 1;
                case 'week':
                    return daysDiff < 7;
                case 'month':
                    return daysDiff < 30;
                case 'inactive-week':
                    return daysDiff >= 7;
                case 'inactive-month':
                    return daysDiff >= 30;
                default:
                    return true;
            }
        });
    }

    employeesFiltered = result;
    updateEmployeeFilterCount();
}

function updateEmployeeFilterCount() {
    const count = Object.values(employeesFilters).filter(val => val !== '').length;
    const countElement = document.getElementById('filter-count');
    
    if (count > 0) {
        countElement.textContent = count;
        countElement.style.display = 'inline-block';
    } else {
        countElement.style.display = 'none';
    }
}

function resetEmployeeFilters() {
    employeesFilters = {
        rank: '',
        hiredAfter: '',
        hiredBefore: '',
        login: ''
    };

    document.getElementById('filter-rank').value = '';
    document.getElementById('filter-hired-after').value = '';
    document.getElementById('filter-hired-before').value = '';
    document.getElementById('filter-login').value = '';

    employeesFiltered = [...employeesData];
    
    // Réappliquer la recherche si elle existe
    const searchTerm = document.getElementById('search-input').value;
    if (searchTerm) {
        handleEmployeeSearch(searchTerm);
    } else {
        sortEmployeesData();
        employeesCurrentPage = 1;
        displayEmployeesTable();
        updateEmployeeFilterCount();
    }

    notify.success('Filtres réinitialisés', 'Tous les filtres ont été supprimés');
}

// ========================================
// PAGINATION
// ========================================

function updateEmployeesPagination() {
    const totalPages = Math.ceil(employeesFiltered.length / employeesPerPage);
    const startIndex = (employeesCurrentPage - 1) * employeesPerPage;
    const endIndex = Math.min(startIndex + employeesPerPage, employeesFiltered.length);

    document.getElementById('showing-from').textContent = employeesFiltered.length > 0 ? startIndex + 1 : 0;
    document.getElementById('showing-to').textContent = endIndex;
    document.getElementById('total-records').textContent = employeesFiltered.length;

    // Boutons précédent/suivant
    document.getElementById('prev-page').disabled = employeesCurrentPage === 1;
    document.getElementById('next-page').disabled = employeesCurrentPage === totalPages || totalPages === 0;

    // Numéros de page
    const pageNumbersContainer = document.getElementById('page-numbers');
    pageNumbersContainer.innerHTML = '';

    const maxButtons = 5;
    let startPage = Math.max(1, employeesCurrentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);

    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.className = 'page-number' + (i === employeesCurrentPage ? ' active' : '');
        btn.textContent = i;
        btn.addEventListener('click', () => {
            employeesCurrentPage = i;
            displayEmployeesTable();
        });
        pageNumbersContainer.appendChild(btn);
    }
}

// ========================================
// INDICATEURS DE TRI
// ========================================

function updateEmployeesSortIndicators() {
    document.querySelectorAll('.employees-table th').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
        
        const sortColumn = th.getAttribute('data-sort');
        if (sortColumn === employeesSort.column) {
            th.classList.add(`sorted-${employeesSort.direction}`);
        }
    });
}

// ========================================
// UTILITAIRES
// ========================================

function formatEmployeeDate(dateString) {
    return dateTime.formatDate(dateString);
}

function getEmployeeLoginStatus(lastLogin) {
    if (!lastLogin) {
        return { status: 'never', text: 'Jamais' };
    }

    if (dateTime.isToday(lastLogin)) {
        return { status: 'active', text: 'Aujourd\'hui' };
    } else if (dateTime.isThisWeek(lastLogin)) {
        return { status: 'recent', text: dateTime.formatDate(lastLogin) };
    } else if (dateTime.isThisMonth(lastLogin)) {
        return { status: 'inactive', text: dateTime.formatDate(lastLogin) };
    } else {
        return { status: 'inactive', text: dateTime.formatDate(lastLogin) };
    }
}

function exportEmployeesToTXT() {
    // Créer le contenu TXT avec un format lisible
    let txt = '========================================\n';
    txt += '   EAGLE SECURITY - LISTE DES EMPLOYÉS\n';
    txt += '========================================\n\n';
    txt += `Date d'export: ${new Date().toLocaleDateString('fr-FR', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    })}\n`;
    txt += `Nombre total: ${employeesFiltered.length} employé(s)\n\n`;
    txt += '========================================\n\n';

    employeesFiltered.forEach((emp, index) => {
        txt += `${index + 1}. ${emp.name}\n`;
        txt += `   Badge: #${String(emp.id).padStart(4, '0')}\n`;
        txt += `   Grade: ${emp.rank_name || 'N/A'}\n`;
        txt += `   Email: ${emp.email}\n`;
        txt += `   Téléphone: ${emp.phone || 'Non renseigné'}\n`;
        txt += `   Date d'arrivée: ${formatEmployeeDate(emp.hired_date)}\n`;
        txt += `   Dernier login: ${emp.last_login ? formatEmployeeDate(emp.last_login) : 'Jamais connecté'}\n`;
        txt += '\n' + '-'.repeat(50) + '\n\n';
    });

    txt += '========================================\n';
    txt += 'Fin du rapport\n';
    txt += '========================================\n';

    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `employees_${new Date().toISOString().split('T')[0]}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    notify.success('Export réussi', 'Fichier TXT téléchargé');
}

// ========================================
// EVENT LISTENERS
// ========================================

function initializeEmployeeListeners() {
    // Recherche
    const searchInput = document.getElementById('search-input');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            handleEmployeeSearch(e.target.value);
        }, 300);
    });

    // Tri des colonnes
    document.querySelectorAll('.employees-table th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.getAttribute('data-sort');
            
            if (employeesSort.column === column) {
                employeesSort.direction = employeesSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                employeesSort.column = column;
                employeesSort.direction = 'asc';
            }

            sortEmployeesData();
            displayEmployeesTable();
        });
    });

    // Boutons pagination
    document.getElementById('prev-page').addEventListener('click', () => {
        if (employeesCurrentPage > 1) {
            employeesCurrentPage--;
            displayEmployeesTable();
        }
    });

    document.getElementById('next-page').addEventListener('click', () => {
        const totalPages = Math.ceil(employeesFiltered.length / employeesPerPage);
        if (employeesCurrentPage < totalPages) {
            employeesCurrentPage++;
            displayEmployeesTable();
        }
    });

    // Popup filtres
    const filterOverlay = document.getElementById('filter-overlay');
    const filterBtn = document.getElementById('filter-btn');
    const closeFilter = document.getElementById('close-filter');

    filterBtn.addEventListener('click', () => {
        filterOverlay.classList.add('active');
    });

    closeFilter.addEventListener('click', () => {
        filterOverlay.classList.remove('active');
    });

    filterOverlay.addEventListener('click', (e) => {
        if (e.target === filterOverlay) {
            filterOverlay.classList.remove('active');
        }
    });

    // Appliquer filtres
    document.getElementById('apply-filters').addEventListener('click', () => {
        employeesFilters.rank = document.getElementById('filter-rank').value;
        employeesFilters.hiredAfter = document.getElementById('filter-hired-after').value;
        employeesFilters.hiredBefore = document.getElementById('filter-hired-before').value;
        employeesFilters.login = document.getElementById('filter-login').value;

        const searchTerm = document.getElementById('search-input').value;
        if (searchTerm) {
            handleEmployeeSearch(searchTerm);
        } else {
            employeesFiltered = [...employeesData];
            applyEmployeeFilters();
            sortEmployeesData();
            employeesCurrentPage = 1;
            displayEmployeesTable();
        }

        filterOverlay.classList.remove('active');
        notify.success('Filtres appliqués', 'Les résultats ont été filtrés');
    });

    // Réinitialiser filtres
    document.getElementById('reset-filters').addEventListener('click', () => {
        resetEmployeeFilters();
    });

    // Export TXT
    document.getElementById('export-btn').addEventListener('click', () => {
        exportEmployeesToTXT();
    });

    // Modal employé
    initializeEmployeeModal();
}

// ========================================
// MODAL EMPLOYÉ
// ========================================

let currentEmployeeId = null;

function initializeEmployeeModal() {
    const modalOverlay = document.getElementById('employee-modal-overlay');
    const closeBtn = document.getElementById('close-employee-modal');

    // Fermer avec le bouton X
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeEmployeeModal();
        });
    }

    // Fermer en cliquant sur l'overlay
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeEmployeeModal();
            }
        });
    }

    // Fermer avec Échap
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay && modalOverlay.classList.contains('active')) {
            closeEmployeeModal();
        }
    });

    // Boutons ajouter note/sanction
    const addNoteBtn = document.getElementById('add-note-btn');
    const addSanctionBtn = document.getElementById('add-sanction-btn');

    if (addNoteBtn) {
        addNoteBtn.addEventListener('click', () => {
            openAddNotePopup();
        });
    }

    if (addSanctionBtn) {
        addSanctionBtn.addEventListener('click', () => {
            openAddSanctionPopup();
        });
    }

    // Bouton ajouter un employé
    const addEmployeeBtn = document.getElementById('add-employee-btn');
    if (addEmployeeBtn) {
        addEmployeeBtn.addEventListener('click', () => {
            openAddEmployeeModal();
        });
    }

    // Bouton supprimer un employé
    const deleteEmployeeBtn = document.getElementById('delete-employee-btn');
    if (deleteEmployeeBtn) {
        deleteEmployeeBtn.addEventListener('click', () => {
            openDeleteConfirmation();
        });
    }
}

// ========================================
// AJOUTER UNE NOTE
// ========================================

function openAddNotePopup() {
    const popup = document.createElement('div');
    popup.className = 'add-item-overlay';
    popup.innerHTML = `
        <div class="add-item-popup">
            <div class="add-item-header">
                <h3>📝 Ajouter une Note</h3>
                <button class="close-add-item" onclick="this.closest('.add-item-overlay').remove()">✕</button>
            </div>
            <div class="add-item-body">
                <label for="note-content">Note</label>
                <textarea 
                    id="note-content" 
                    placeholder="Saisir la note..." 
                    rows="6"
                    maxlength="1000"
                ></textarea>
                <div class="char-count">
                    <span id="note-char-count">0</span> / 1000 caractères
                </div>
            </div>
            <div class="add-item-footer">
                <button class="btn-cancel" onclick="this.closest('.add-item-overlay').remove()">Annuler</button>
                <button class="btn-submit" id="submit-note-btn">Ajouter</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    // Focus sur le textarea
    const textarea = document.getElementById('note-content');
    textarea.focus();
    
    // Compteur de caractères
    const charCount = document.getElementById('note-char-count');
    textarea.addEventListener('input', () => {
        charCount.textContent = textarea.value.length;
    });
    
    // Soumettre
    const submitBtn = document.getElementById('submit-note-btn');
    submitBtn.addEventListener('click', async () => {
        const content = textarea.value.trim();
        
        if (!content) {
            notify.warning('Champ vide', 'Veuillez saisir une note');
            return;
        }
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Ajout en cours...';
        
        const success = await addEmployeeNote(currentEmployeeId, content);
        
        if (success) {
            popup.remove();
            await loadEmployeeNotes(currentEmployeeId);
            notify.success('Note ajoutée', 'La note a été enregistrée avec succès');
        } else {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Ajouter';
        }
    });
    
    // Fermer avec Escape
    popup.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            popup.remove();
        }
    });
}

async function addEmployeeNote(employeeId, note) {
    try {
        const response = await authManager.fetch(`${EMPLOYEES_API_URL}/employees/${employeeId}/notes`, {
            method: 'POST',
            body: JSON.stringify({ note })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Erreur lors de l\'ajout');
        }

        const data = await response.json();
        return data.success;

    } catch (error) {
        console.error('Add note error:', error);
        notify.error('Erreur', error.message || 'Impossible d\'ajouter la note');
        return false;
    }
}

// ========================================
// AJOUTER UNE SANCTION
// ========================================

function openAddSanctionPopup() {
    const popup = document.createElement('div');
    popup.className = 'add-item-overlay';
    popup.innerHTML = `
        <div class="add-item-popup">
            <div class="add-item-header">
                <h3>⚠️ Ajouter une Sanction</h3>
                <button class="close-add-item" onclick="this.closest('.add-item-overlay').remove()">✕</button>
            </div>
            <div class="add-item-body">
                <label for="sanction-type">Type de Sanction</label>
                <select id="sanction-type" class="sanction-select">
                    <option value="">-- Sélectionner --</option>
                    <option value="Avertissement">⚠️ Avertissement</option>
                    <option value="Blâme">🔴 Blâme</option>
                    <option value="Mise à pied">⛔ Mise à pied</option>
                    <option value="Licenciement">❌ Licenciement</option>
                </select>
                
                <label for="sanction-reason" style="margin-top: 1rem;">Motif</label>
                <textarea 
                    id="sanction-reason" 
                    placeholder="Décrire le motif de la sanction..." 
                    rows="6"
                    maxlength="1000"
                ></textarea>
                <div class="char-count">
                    <span id="sanction-char-count">0</span> / 1000 caractères
                </div>
            </div>
            <div class="add-item-footer">
                <button class="btn-cancel" onclick="this.closest('.add-item-overlay').remove()">Annuler</button>
                <button class="btn-submit" id="submit-sanction-btn">Ajouter</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    // Focus sur le select
    const selectType = document.getElementById('sanction-type');
    selectType.focus();
    
    // Compteur de caractères
    const textarea = document.getElementById('sanction-reason');
    const charCount = document.getElementById('sanction-char-count');
    textarea.addEventListener('input', () => {
        charCount.textContent = textarea.value.length;
    });
    
    // Soumettre
    const submitBtn = document.getElementById('submit-sanction-btn');
    submitBtn.addEventListener('click', async () => {
        const type = selectType.value;
        const reason = textarea.value.trim();
        
        if (!type) {
            notify.warning('Type manquant', 'Veuillez sélectionner un type de sanction');
            return;
        }
        
        if (!reason) {
            notify.warning('Motif manquant', 'Veuillez décrire le motif');
            return;
        }
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Ajout en cours...';
        
        const success = await addEmployeeSanction(currentEmployeeId, type, reason);
        
        if (success) {
            popup.remove();
            await loadEmployeeSanctions(currentEmployeeId);
            notify.success('Sanction ajoutée', 'La sanction a été enregistrée avec succès');
        } else {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Ajouter';
        }
    });
    
    // Fermer avec Escape
    popup.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            popup.remove();
        }
    });
}

async function addEmployeeSanction(employeeId, sanctionType, reason) {
    try {
        const response = await authManager.fetch(`${EMPLOYEES_API_URL}/employees/${employeeId}/sanctions`, {
            method: 'POST',
            body: JSON.stringify({ 
                sanction_type: sanctionType, 
                reason 
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Erreur lors de l\'ajout');
        }

        const data = await response.json();
        return data.success;

    } catch (error) {
        console.error('Add sanction error:', error);
        notify.error('Erreur', error.message || 'Impossible d\'ajouter la sanction');
        return false;
    }
}

async function openEmployeeModal(employeeId) {
    currentEmployeeId = employeeId;
    
    try {
        // Récupérer les détails de l'employé
        const response = await authManager.fetch(`${EMPLOYEES_API_URL}/employees/${employeeId}`);

        if (!response.ok) {
            throw new Error('Erreur lors du chargement des détails');
        }

        const data = await response.json();
        
        if (data.success) {
            displayEmployeeDetails(data.employee);
            await loadEmployeeNotes(employeeId);
            await loadEmployeeSanctions(employeeId);
            
            // Ouvrir le modal
            document.getElementById('employee-modal-overlay').classList.add('active');

            // Attacher l'événement de clic sur l'avatar APRÈS l'ouverture du modal
            setupAvatarUpload();
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Error loading employee details:', error);
        notify.error('Erreur', 'Impossible de charger les détails de l\'employé');
    }
}

function setupAvatarUpload() {
    const avatarContainer = document.getElementById('modal-avatar');
    const avatarInput = document.getElementById('avatar-upload-input');

    if (!avatarContainer || !avatarInput) {
        console.error('Avatar elements not found in modal');
        return;
    }

    // Vérifier si déjà configuré pour éviter les doublons
    if (avatarContainer.dataset.uploadConfigured === 'true') {
        console.log('Avatar upload already configured');
        return;
    }

    // Marquer comme configuré
    avatarContainer.dataset.uploadConfigured = 'true';

    // Attacher l'événement de clic
    avatarContainer.addEventListener('click', (e) => {
        // Ne pas déclencher si on clique sur l'overlay
        if (e.target.classList.contains('avatar-upload-overlay')) {
            return;
        }
        console.log('Avatar clicked, opening file selector...');
        avatarInput.click();
    });

    // Attacher l'événement de changement
    avatarInput.addEventListener('change', async (e) => {
        console.log('File selected');
        const file = e.target.files[0];
        if (file && currentEmployeeId) {
            await uploadEmployeeAvatar(file, currentEmployeeId);
            // Réinitialiser l'input pour permettre de sélectionner le même fichier
            e.target.value = '';
        }
    });
}

function closeEmployeeModal() {
    document.getElementById('employee-modal-overlay').classList.remove('active');
    currentEmployeeId = null;
}

function displayEmployeeDetails(employee) {
    // Avatar
    const avatarEl = document.getElementById('modal-avatar');
    if (employee.avatar_url) {
        avatarEl.innerHTML = `
            <img src="${employee.avatar_url}" alt="${employee.name}">
            <div class="avatar-upload-overlay">📸 Changer la photo</div>
        `;
    } else {
        const initials = employee.name
            .split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .substring(0, 2);
        avatarEl.innerHTML = `
            ${initials}
            <div class="avatar-upload-overlay">📸 Changer la photo</div>
        `;
    }

    // Grade
    const rankEl = document.getElementById('modal-rank');
    rankEl.textContent = employee.rank_name || 'N/A';
    rankEl.className = `employee-rank-badge rank-${employee.hierarchy}`;

    // Nom
    document.getElementById('modal-name').textContent = employee.name;

    // Email
    document.getElementById('modal-email').textContent = employee.email;

    // Téléphone
    document.getElementById('modal-phone').textContent = employee.phone || 'Non renseigné';

    // Badge
    document.getElementById('modal-badge').textContent = `#${String(employee.id).padStart(4, '0')}`;

    // Date d'entrée
    document.getElementById('modal-hired').textContent = formatEmployeeDate(employee.hired_date);

    // Dernier login
    const loginStatus = getEmployeeLoginStatus(employee.last_login);
    document.getElementById('modal-login').textContent = loginStatus.text;
}

async function loadEmployeeNotes(employeeId) {
    try {
        const response = await authManager.fetch(`${EMPLOYEES_API_URL}/employees/${employeeId}/notes`);

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                displayNotes(data.notes);
                return;
            }
        }
        
        // Si erreur ou pas de notes
        displayNotes([]);
    } catch (error) {
        console.error('Error loading notes:', error);
        displayNotes([]);
    }
}

function displayNotes(notes) {
    const notesList = document.getElementById('notes-list');
    
    if (notes.length === 0) {
        notesList.innerHTML = '<div class="empty-notes">Aucune note</div>';
        return;
    }

    notesList.innerHTML = notes.map(note => `
        <div class="note-item" data-note-id="${note.id}">
            <div class="note-header">
                <span class="note-author">${note.author_name || 'Système'}</span>
                <div class="note-actions">
                    <span class="note-date">${formatEmployeeDate(note.created_at)}</span>
                    <button class="delete-note-btn" data-note-id="${note.id}" title="Supprimer">🗑️</button>
                </div>
            </div>
            <div class="note-content">${escapeHtml(note.note)}</div>
        </div>
    `).join('');

    // Ajouter les listeners pour les boutons de suppression
    document.querySelectorAll('.delete-note-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const noteId = btn.getAttribute('data-note-id');
            confirmDeleteNote(noteId);
        });
    });
}

async function loadEmployeeSanctions(employeeId) {
    try {
        const response = await authManager.fetch(`${EMPLOYEES_API_URL}/employees/${employeeId}/sanctions`);

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                displaySanctions(data.sanctions);
                return;
            }
        }
        
        // Si erreur ou pas de sanctions
        displaySanctions([]);
    } catch (error) {
        console.error('Error loading sanctions:', error);
        displaySanctions([]);
    }
}

function displaySanctions(sanctions) {
    const sanctionsList = document.getElementById('sanctions-list');
    
    if (sanctions.length === 0) {
        sanctionsList.innerHTML = '<div class="empty-sanctions">Aucune sanction</div>';
        return;
    }

    const sanctionTypeMap = {
        'Avertissement': 'warning',
        'Blâme': 'blame',
        'Mise à pied': 'suspension',
        'Licenciement': 'dismissal'
    };

    sanctionsList.innerHTML = sanctions.map(sanction => {
        const typeClass = sanctionTypeMap[sanction.sanction_type] || 'warning';
        
        return `
            <div class="sanction-item" data-sanction-id="${sanction.id}">
                <div class="sanction-header">
                    <span class="sanction-type ${typeClass}">${sanction.sanction_type}</span>
                    <div class="sanction-actions">
                        <span class="sanction-date">${formatEmployeeDate(sanction.issued_at)}</span>
                        <button class="delete-sanction-btn" data-sanction-id="${sanction.id}" title="Supprimer">🗑️</button>
                    </div>
                </div>
                <div class="sanction-reason">${escapeHtml(sanction.reason)}</div>
                <div class="sanction-issuer">Émise par: ${sanction.issuer_name || 'N/A'}</div>
            </div>
        `;
    }).join('');

    // Ajouter les listeners pour les boutons de suppression
    document.querySelectorAll('.delete-sanction-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sanctionId = btn.getAttribute('data-sanction-id');
            confirmDeleteSanction(sanctionId);
        });
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// UPLOAD AVATAR
// ========================================

async function uploadEmployeeAvatar(file, employeeId) {
    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
        notify.error('Fichier invalide', 'Veuillez sélectionner une image');
        return;
    }

    // Vérifier la taille (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        notify.error('Fichier trop volumineux', 'La taille maximale est de 5 MB');
        return;
    }

    notify.info('Upload en cours', 'Optimisation de l\'image...');

    try {
        // Convertir l'image en base64 avec haute qualité
        // maxSize: 800px (bonne taille pour avatar)
        // quality: 0.92 (92% de qualité - excellent compromis taille/qualité)
        const base64 = await fileToBase64(file, 800, 0.92);

        // Envoyer au Worker qui gérera l'upload vers ImgBB
        const response = await authManager.fetch(`${EMPLOYEES_API_URL}/employees/${employeeId}/avatar/upload`, {
            method: 'POST',
            body: JSON.stringify({
                image: base64,
                filename: file.name
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Erreur lors de l\'upload');
        }

        const data = await response.json();

        if (data.success) {
            const avatarUrl = data.avatar_url;

            // Mettre à jour l'affichage dans le modal
            const avatarEl = document.getElementById('modal-avatar');
            avatarEl.innerHTML = `
                <img src="${avatarUrl}" alt="Avatar">
                <div class="avatar-upload-overlay">📸 Changer la photo</div>
            `;

            // Mettre à jour le cache local
            const employee = employeesData.find(e => e.id == employeeId);
            if (employee) {
                employee.avatar_url = avatarUrl;
            }

            // Si c'est l'utilisateur connecté, mettre à jour la navbar
            if (employeeId == empUser.id) {
                const navAvatarEl = document.getElementById('user-avatar-nav');
                if (navAvatarEl) {
                    navAvatarEl.innerHTML = `<img src="${avatarUrl}" alt="${empUser.name}">`;
                }
                
                // Mettre à jour le localStorage
                const user = authManager.getUser();
                user.avatar_url = avatarUrl;
                localStorage.setItem('eagle_user', JSON.stringify(user));
            }

            // Rafraîchir le tableau
            displayEmployeesTable();

            notify.success('Avatar mis à jour', 'La photo a été changée avec succès');
        } else {
            throw new Error('Erreur lors de l\'upload');
        }

    } catch (error) {
        console.error('Upload avatar error:', error);
        notify.error('Erreur d\'upload', error.message || 'Impossible de télécharger l\'image');
    }
}

/**
 * Convertir un fichier image en base64 avec compression et redimensionnement optimisés
 * @param {File} file - Fichier image
 * @param {number} maxSize - Taille maximale en pixels (défaut: 800)
 * @param {number} quality - Qualité de compression 0-1 (défaut: 0.92)
 * @returns {Promise<string>} Base64 de l'image optimisée
 */
function fileToBase64(file, maxSize = 800, quality = 0.92) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                // Créer un canvas pour redimensionner
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculer les nouvelles dimensions (garder le ratio)
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > maxSize) {
                        height = (height * maxSize) / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = (width * maxSize) / height;
                        height = maxSize;
                    }
                }
                
                // Définir la taille du canvas
                canvas.width = width;
                canvas.height = height;
                
                // Activer le lissage pour une meilleure qualité
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // Dessiner l'image redimensionnée
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convertir en base64 avec la qualité spécifiée
                // Pour JPEG: quality entre 0 et 1
                // Pour PNG: pas de paramètre de qualité (lossless)
                const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                const base64 = canvas.toDataURL(mimeType, quality);
                
                resolve(base64);
            };
            
            img.onerror = () => {
                reject(new Error('Impossible de charger l\'image'));
            };
            
            img.src = e.target.result;
        };
        
        reader.onerror = () => {
            reject(new Error('Erreur lors de la lecture du fichier'));
        };
        
        reader.readAsDataURL(file);
    });
}

// ========================================
// AJOUTER UN NOUVEL EMPLOYÉ
// ========================================

function openAddEmployeeModal() {
    const popup = document.createElement('div');
    popup.className = 'add-item-overlay';
    popup.innerHTML = `
        <div class="add-employee-modal">
            <div class="add-item-header">
                <h3>Ajouter un Agent</h3>
                <button class="close-add-item" onclick="this.closest('.add-item-overlay').remove()">✕</button>
            </div>
            <div class="add-item-body add-employee-body">
                <div class="form-row">
                    <div class="form-group">
                        <label for="employee-name">Nom complet *</label>
                        <input 
                            type="text" 
                            id="employee-name" 
                            placeholder="John Doe"
                            maxlength="100"
                            required
                        >
                    </div>
                    <div class="form-group">
                        <label for="employee-badge">Numéro de Badge *</label>
                        <input 
                            type="number" 
                            id="employee-badge" 
                            placeholder="Ex: 1001"
                            min="1"
                            max="9999"
                            required
                        >
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="employee-rank">Grade *</label>
                        <select id="employee-rank" required>
                            <option value="">-- Sélectionner un grade --</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="employee-phone">Téléphone</label>
                        <input 
                            type="tel" 
                            id="employee-phone" 
                            placeholder="+1 (310) 555-0000"
                            maxlength="20"
                        >
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="employee-email">Email professionnel *</label>
                        <input 
                            type="email" 
                            id="employee-email" 
                            placeholder="john.doe@eaglesecurity.com"
                            maxlength="100"
                            required
                        >
                    </div>
                    <div class="form-group">
                        <label for="employee-password">Mot de passe *</label>
                        <input 
                            type="password" 
                            id="employee-password" 
                            placeholder="Minimum 8 caractères"
                            minlength="8"
                            required
                        >
                    </div>
                </div>

                <div class="form-note">
                    <small>* Champs obligatoires</small>
                    <small>La date d'arrivée sera automatiquement définie à aujourd'hui</small>
                </div>
            </div>
            <div class="add-item-footer">
                <button class="btn-cancel" onclick="this.closest('.add-item-overlay').remove()">Annuler</button>
                <button class="btn-submit" id="submit-employee-btn">Créer l'Agent</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    // Charger les grades dans le select
    loadRanksForSelect();
    
    // Focus sur le nom (premier champ)
    const nameInput = document.getElementById('employee-name');
    nameInput.focus();
    
    // Soumettre
    const submitBtn = document.getElementById('submit-employee-btn');
    submitBtn.addEventListener('click', async () => {
        const badge = document.getElementById('employee-badge').value.trim();
        const name = document.getElementById('employee-name').value.trim();
        const email = document.getElementById('employee-email').value.trim();
        const password = document.getElementById('employee-password').value;
        const phone = document.getElementById('employee-phone').value.trim();
        const rankSelect = document.getElementById('employee-rank');
        const rankId = rankSelect.value;
        
        // Validation badge
        if (!badge) {
            notify.warning('Badge manquant', 'Veuillez saisir un numéro de badge');
            return;
        }

        const badgeNum = parseInt(badge);
        if (isNaN(badgeNum) || badgeNum < 1 || badgeNum > 9999) {
            notify.warning('Badge invalide', 'Le badge doit être entre 1 et 9999');
            return;
        }
        
        // Validation
        if (!name) {
            notify.warning('Nom manquant', 'Veuillez saisir le nom complet');
            return;
        }
        
        if (!email) {
            notify.warning('Email manquant', 'Veuillez saisir l\'email professionnel');
            return;
        }
        
        // Validation email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            notify.error('Email invalide', 'Le format de l\'email est incorrect');
            return;
        }
        
        if (!password) {
            notify.warning('Mot de passe manquant', 'Veuillez définir un mot de passe');
            return;
        }
        
        if (password.length < 8) {
            notify.warning('Mot de passe trop court', 'Minimum 8 caractères requis');
            return;
        }
        
        if (!rankId) {
            notify.warning('Grade manquant', 'Veuillez sélectionner un grade');
            return;
        }
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Création en cours...';
        
        const success = await createEmployee({
            id: badgeNum,
            name,
            email,
            password,
            phone: phone || null,
            rank_id: parseInt(rankId)
        });
        
        if (success) {
            popup.remove();
            await loadEmployeesData();
            notify.success('Agent créé', `${name} (Badge #${String(badgeNum).padStart(4, '0')}) a été ajouté avec succès`);
        } else {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Créer l\'Agent';
        }
    });
    
    // Fermer avec Escape
    popup.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            popup.remove();
        }
    });
}

async function loadRanksForSelect() {
    try {
        const response = await authManager.fetch(`${EMPLOYEES_API_URL}/ranks`);

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                const select = document.getElementById('employee-rank');
                data.ranks.forEach(rank => {
                    const option = document.createElement('option');
                    option.value = rank.id;
                    option.textContent = rank.name;
                    select.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading ranks:', error);
    }
}

async function createEmployee(employeeData) {
    try {
        const response = await authManager.fetch(`${EMPLOYEES_API_URL}/employees`, {
            method: 'POST',
            body: JSON.stringify(employeeData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Erreur lors de la création');
        }

        const data = await response.json();
        return data.success;

    } catch (error) {
        console.error('Create employee error:', error);
        notify.error('Erreur', error.message || 'Impossible de créer l\'agent');
        return false;
    }
}

// ========================================
// SUPPRIMER UN EMPLOYÉ
// ========================================

function openDeleteConfirmation() {
    if (!currentEmployeeId) {
        notify.error('Erreur', 'Aucun employé sélectionné');
        return;
    }

    // Récupérer les infos de l'employé depuis le modal
    const employeeName = document.getElementById('modal-name').textContent;
    const employeeBadge = currentEmployeeId;

    const popup = document.createElement('div');
    popup.className = 'add-item-overlay';
    popup.innerHTML = `
        <div class="add-item-popup delete-confirmation-popup">
            <div class="add-item-header delete-header">
                <h3>⚠️ Confirmer la Suppression</h3>
                <button class="close-add-item" onclick="this.closest('.add-item-overlay').remove()">✕</button>
            </div>
            <div class="add-item-body">
                <div class="delete-warning">
                    <p class="delete-warning-text">
                        Vous êtes sur le point de supprimer l'agent :
                    </p>
                    <div class="delete-employee-info">
                        <strong>${employeeName}</strong>
                        <span>Badge #${String(employeeBadge).padStart(4, '0')}</span>
                    </div>
                    <p class="delete-warning-danger">
                        ⚠️ <strong>Cette action est irréversible !</strong>
                    </p>
                    <p class="delete-warning-details">
                        Toutes les données associées seront également supprimées :
                    </p>
                    <ul class="delete-warning-list">
                        <li>📝 Notes de l'agent</li>
                        <li>⚠️ Sanctions enregistrées</li>
                        <li>📊 Historique complet</li>
                    </ul>
                </div>
            </div>
            <div class="add-item-footer">
                <button class="btn-cancel" onclick="this.closest('.add-item-overlay').remove()">Annuler</button>
                <button class="btn-delete" id="confirm-delete-btn">Supprimer définitivement</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    // Bouton confirmer la suppression
    const confirmBtn = document.getElementById('confirm-delete-btn');
    confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Suppression en cours...';
        
        const success = await deleteEmployee(currentEmployeeId);
        
        if (success) {
            popup.remove();
            closeEmployeeModal();
            await loadEmployeesData();
            notify.success('Agent supprimé', `${employeeName} a été supprimé avec succès`);
        } else {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Supprimer définitivement';
        }
    });
    
    // Fermer avec Escape
    popup.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            popup.remove();
        }
    });
}

async function deleteEmployee(employeeId) {
    try {
        const response = await authManager.fetch(`${EMPLOYEES_API_URL}/employees/${employeeId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Erreur lors de la suppression');
        }

        const data = await response.json();
        return data.success;

    } catch (error) {
        console.error('Delete employee error:', error);
        notify.error('Erreur', error.message || 'Impossible de supprimer l\'agent');
        return false;
    }
}

// ========================================
// SUPPRIMER UNE NOTE
// ========================================

function confirmDeleteNote(noteId) {
    const popup = document.createElement('div');
    popup.className = 'add-item-overlay';
    popup.innerHTML = `
        <div class="add-item-popup delete-confirmation-popup">
            <div class="add-item-header delete-header">
                <h3>⚠️ Supprimer la Note</h3>
                <button class="close-add-item" onclick="this.closest('.add-item-overlay').remove()">✕</button>
            </div>
            <div class="add-item-body">
                <p style="color: #B0B0B0; text-align: center;">
                    Êtes-vous sûr de vouloir supprimer cette note ?<br>
                    <strong style="color: #FFB3B3;">Cette action est irréversible.</strong>
                </p>
            </div>
            <div class="add-item-footer">
                <button class="btn-cancel" onclick="this.closest('.add-item-overlay').remove()">Annuler</button>
                <button class="btn-delete" id="confirm-delete-note-btn">Supprimer</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    const confirmBtn = document.getElementById('confirm-delete-note-btn');
    confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Suppression...';
        
        const success = await deleteNote(noteId);
        
        if (success) {
            popup.remove();
            await loadEmployeeNotes(currentEmployeeId);
            notify.success('Note supprimée', 'La note a été supprimée avec succès');
        } else {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Supprimer';
        }
    });
    
    popup.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            popup.remove();
        }
    });
}

async function deleteNote(noteId) {
    try {
        const response = await authManager.fetch(`${EMPLOYEES_API_URL}/notes/${noteId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Erreur lors de la suppression');
        }

        const data = await response.json();
        return data.success;

    } catch (error) {
        console.error('Delete note error:', error);
        notify.error('Erreur', error.message || 'Impossible de supprimer la note');
        return false;
    }
}

// ========================================
// SUPPRIMER UNE SANCTION
// ========================================

function confirmDeleteSanction(sanctionId) {
    const popup = document.createElement('div');
    popup.className = 'add-item-overlay';
    popup.innerHTML = `
        <div class="add-item-popup delete-confirmation-popup">
            <div class="add-item-header delete-header">
                <h3>⚠️ Supprimer la Sanction</h3>
                <button class="close-add-item" onclick="this.closest('.add-item-overlay').remove()">✕</button>
            </div>
            <div class="add-item-body">
                <p style="color: #B0B0B0; text-align: center;">
                    Êtes-vous sûr de vouloir supprimer cette sanction ?<br>
                    <strong style="color: #FFB3B3;">Cette action est irréversible.</strong>
                </p>
            </div>
            <div class="add-item-footer">
                <button class="btn-cancel" onclick="this.closest('.add-item-overlay').remove()">Annuler</button>
                <button class="btn-delete" id="confirm-delete-sanction-btn">Supprimer</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    const confirmBtn = document.getElementById('confirm-delete-sanction-btn');
    confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Suppression...';
        
        const success = await deleteSanction(sanctionId);
        
        if (success) {
            popup.remove();
            await loadEmployeeSanctions(currentEmployeeId);
            notify.success('Sanction supprimée', 'La sanction a été supprimée avec succès');
        } else {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Supprimer';
        }
    });
    
    popup.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            popup.remove();
        }
    });
}

async function deleteSanction(sanctionId) {
    try {
        const response = await authManager.fetch(`${EMPLOYEES_API_URL}/sanctions/${sanctionId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Erreur lors de la suppression');
        }

        const data = await response.json();
        return data.success;

    } catch (error) {
        console.error('Delete sanction error:', error);
        notify.error('Erreur', error.message || 'Impossible de supprimer la sanction');
        return false;
    }
}