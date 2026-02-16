// ========================================
// SUBMISSIONS PAGE HANDLER
// ========================================

// Vérifier si l'utilisateur est connecté avec authManager
if (!authManager.requireAuth()) {
    throw new Error('Non authentifié');
}

// Récupérer l'utilisateur via authManager
const subUser = authManager.getUser();

// URL de l'API Cloudflare Worker
const SUBMISSIONS_API_URL = 'https://eagle-security.charliemoimeme.workers.dev/api';

// Variables globales
let submissionsData = [];
let submissionsFiltered = [];
let archivedSubmissions = [];
let submissionsCurrentPage = 1;
let submissionsPerPage = 15;
let submissionsSort = { column: 'date', direction: 'desc' };
let submissionsFilters = {
    type: '',
    status: '',
    dateAfter: '',
    dateBefore: '',
    handled: ''
};

// ========================================
// INITIALISATION
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
    loadCurrentUserAvatar();
    await loadSubmissionsData();
    initializeSubmissionListeners();
});

// ========================================
// CHARGER L'AVATAR UTILISATEUR NAVBAR
// ========================================

function loadCurrentUserAvatar() {
    const avatarEl = document.getElementById('user-avatar-nav');
    
    if (!avatarEl || !subUser.id) {
        return;
    }

    // Si on a déjà l'avatar_url dans subUser
    if (subUser.avatar_url) {
        avatarEl.innerHTML = `<img src="${subUser.avatar_url}" alt="${subUser.name}">`;
    } else {
        // Sinon, afficher les initiales
        const initials = subUser.name
            .split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .substring(0, 2);
        avatarEl.textContent = initials;
    }
}

// ========================================
// CHARGEMENT DES DONNÉES
// ========================================

async function loadSubmissionsData() {
    try {
        const response = await authManager.fetch(`${SUBMISSIONS_API_URL}/contact-submissions`);

        if (!response.ok) {
            throw new Error('Erreur lors du chargement des soumissions');
        }

        const data = await response.json();
        
        if (data.success) {
            // Séparer les actives et archivées
            submissionsData = data.submissions.filter(s => s.status !== 'archived');
            archivedSubmissions = data.submissions.filter(s => s.status === 'archived');
            
            // Filtrer selon la prise en charge (ne montrer que mes dossiers pris en charge)
            submissionsFiltered = submissionsData.filter(s => {
                // Si le dossier est pris en charge par quelqu'un d'autre, ne pas le montrer
                if (s.processed_by && s.processed_by !== subUser.id) {
                    return false;
                }
                return true;
            });
            
            // Trier et afficher
            sortSubmissionsData();
            updateSubmissionsStats();
            displaySubmissionsTable();
            displayArchives();
            
            notify.success('Chargement réussi', `${submissionsFiltered.length} soumissions chargées`);
        } else {
            throw new Error(data.message || 'Erreur serveur');
        }
    } catch (error) {
        console.error('Error loading submissions:', error);
        notify.error('Erreur', 'Impossible de charger la liste des soumissions');
        displaySubmissionsEmpty();
    }
}

// ========================================
// TRI DES DONNÉES
// ========================================

function sortSubmissionsData() {
    submissionsFiltered.sort((a, b) => {
        let aVal, bVal;

        switch (submissionsSort.column) {
            case 'date':
                aVal = new Date(a.submitted_at || 0).getTime();
                bVal = new Date(b.submitted_at || 0).getTime();
                break;
            case 'type':
                aVal = a.form_type.toLowerCase();
                bVal = b.form_type.toLowerCase();
                break;
            case 'name':
                aVal = a.nom.toLowerCase();
                bVal = b.nom.toLowerCase();
                break;
            case 'email':
                aVal = a.email.toLowerCase();
                bVal = b.email.toLowerCase();
                break;
            case 'status':
                aVal = a.status;
                bVal = b.status;
                break;
            case 'handler':
                aVal = a.handler_name || 'zzz'; // Non pris en charge en dernier
                bVal = b.handler_name || 'zzz';
                break;
            default:
                return 0;
        }

        if (submissionsSort.direction === 'asc') {
            return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
            return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
    });
}

// ========================================
// AFFICHAGE DU TABLEAU
// ========================================

function displaySubmissionsTable() {
    const tbody = document.getElementById('submissions-tbody');
    
    // Calculer la pagination
    const startIndex = (submissionsCurrentPage - 1) * submissionsPerPage;
    const endIndex = startIndex + submissionsPerPage;
    const pageSubmissions = submissionsFiltered.slice(startIndex, endIndex);

    if (pageSubmissions.length === 0) {
        displaySubmissionsEmpty();
        return;
    }

    // Générer les lignes
    tbody.innerHTML = pageSubmissions.map(sub => {
        const date = formatDate(sub.submitted_at);
        const typeLabel = getTypeLabel(sub.form_type);
        const statusLabel = getStatusLabel(sub.status);
        const handlerName = sub.handler_name || 'Non assigné';

        return `
            <tr data-submission-id="${sub.id}" class="submission-row">
                <td>
                    <span class="submission-date">${date}</span>
                </td>
                <td>
                    <span class="submission-type type-${sub.form_type}">${typeLabel}</span>
                </td>
                <td>
                    <span class="submission-name">${sub.nom}</span>
                </td>
                <td>
                    <span class="submission-email">${sub.email}</span>
                </td>
                <td>
                    <span class="submission-status status-${sub.status}">${statusLabel}</span>
                </td>
                <td>
                    <span class="submission-handler ${sub.processed_by ? 'assigned' : 'unassigned'}">
                        ${handlerName}
                    </span>
                </td>
            </tr>
        `;
    }).join('');

    // Ajouter les événements de clic sur les lignes
    tbody.querySelectorAll('tr[data-submission-id]').forEach(row => {
        row.addEventListener('click', () => {
            const submissionId = row.getAttribute('data-submission-id');
            openSubmissionModal(submissionId);
        });
    });

    updateSubmissionsPagination();
    updateSubmissionsSortIndicators();
}

function displaySubmissionsEmpty() {
    const tbody = document.getElementById('submissions-tbody');
    tbody.innerHTML = `
        <tr class="empty-row">
            <td colspan="6">
                Aucune soumission trouvée
            </td>
        </tr>
    `;
    updateSubmissionsPagination();
}

// ========================================
// AFFICHAGE DES ARCHIVES
// ========================================

function displayArchives() {
    const tbody = document.getElementById('archives-tbody');
    const archivesCount = document.getElementById('archives-count');
    
    archivesCount.textContent = archivedSubmissions.length;

    if (archivedSubmissions.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="6">Aucune archive</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = archivedSubmissions.map(sub => {
        const date = formatDate(sub.submitted_at);
        const typeLabel = getTypeLabel(sub.form_type);
        const archivedDate = formatDate(sub.processed_at);

        return `
            <tr data-submission-id="${sub.id}" class="submission-row archived">
                <td>${date}</td>
                <td><span class="submission-type type-${sub.form_type}">${typeLabel}</span></td>
                <td>${sub.nom}</td>
                <td>${sub.email}</td>
                <td>${sub.handler_name || 'N/A'}</td>
                <td>${archivedDate}</td>
            </tr>
        `;
    }).join('');

    // Ajouter les événements de clic
    tbody.querySelectorAll('tr[data-submission-id]').forEach(row => {
        row.addEventListener('click', () => {
            const submissionId = row.getAttribute('data-submission-id');
            openSubmissionModal(submissionId);
        });
    });
}

// ========================================
// STATISTIQUES
// ========================================

function updateSubmissionsStats() {
    // Total en attente
    const pending = submissionsData.filter(s => s.status === 'pending').length;
    document.getElementById('total-pending').textContent = pending;
    
    // Total traités
    const processed = submissionsData.filter(s => s.status === 'processed').length;
    document.getElementById('total-processed').textContent = processed;
    
    // Total archivés
    document.getElementById('total-archived').textContent = archivedSubmissions.length;
}

// ========================================
// PAGINATION
// ========================================

function updateSubmissionsPagination() {
    const totalPages = Math.ceil(submissionsFiltered.length / submissionsPerPage);
    const startIndex = (submissionsCurrentPage - 1) * submissionsPerPage;
    const endIndex = Math.min(startIndex + submissionsPerPage, submissionsFiltered.length);
    
    document.getElementById('showing-from').textContent = submissionsFiltered.length > 0 ? startIndex + 1 : 0;
    document.getElementById('showing-to').textContent = endIndex;
    document.getElementById('total-records').textContent = submissionsFiltered.length;
    
    // Boutons prev/next
    document.getElementById('prev-page').disabled = submissionsCurrentPage === 1;
    document.getElementById('next-page').disabled = submissionsCurrentPage === totalPages || totalPages === 0;
    
    // Page numbers
    const pageNumbersContainer = document.getElementById('page-numbers');
    pageNumbersContainer.innerHTML = '';
    
    for (let i = 1; i <= totalPages; i++) {
        if (
            i === 1 || 
            i === totalPages || 
            (i >= submissionsCurrentPage - 1 && i <= submissionsCurrentPage + 1)
        ) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `page-number ${i === submissionsCurrentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => {
                submissionsCurrentPage = i;
                displaySubmissionsTable();
            });
            pageNumbersContainer.appendChild(pageBtn);
        } else if (
            i === submissionsCurrentPage - 2 || 
            i === submissionsCurrentPage + 2
        ) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'page-ellipsis';
            pageNumbersContainer.appendChild(ellipsis);
        }
    }
}

// ========================================
// INDICATEURS DE TRI
// ========================================

function updateSubmissionsSortIndicators() {
    const headers = document.querySelectorAll('.submissions-table th[data-sort]');
    headers.forEach(header => {
        header.classList.remove('sorted-asc', 'sorted-desc');
        if (header.getAttribute('data-sort') === submissionsSort.column) {
            header.classList.add(`sorted-${submissionsSort.direction}`);
        }
    });
}

// ========================================
// HELPERS
// ========================================

function formatDate(dateString) {
    return dateTime.format(dateString);
}

function getTypeLabel(type) {
    const labels = {
        'recrutement': 'Recrutement',
        'plainte': 'Plainte',
        'rdv': 'Rendez-vous'
    };
    return labels[type] || type;
}

function getStatusLabel(status) {
    const labels = {
        'pending': 'En attente',
        'processed': 'Traité',
        'archived': 'Archivé'
    };
    return labels[status] || status;
}

// ========================================
// EVENT LISTENERS
// ========================================

function initializeSubmissionListeners() {
    // Recherche
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            handleSubmissionSearch(e.target.value);
        });
    }

    // Tri
    const headers = document.querySelectorAll('.submissions-table th[data-sort]');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const column = header.getAttribute('data-sort');
            if (submissionsSort.column === column) {
                submissionsSort.direction = submissionsSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                submissionsSort.column = column;
                submissionsSort.direction = 'asc';
            }
            sortSubmissionsData();
            displaySubmissionsTable();
        });
    });

    // Pagination
    document.getElementById('prev-page').addEventListener('click', () => {
        if (submissionsCurrentPage > 1) {
            submissionsCurrentPage--;
            displaySubmissionsTable();
        }
    });

    document.getElementById('next-page').addEventListener('click', () => {
        const totalPages = Math.ceil(submissionsFiltered.length / submissionsPerPage);
        if (submissionsCurrentPage < totalPages) {
            submissionsCurrentPage++;
            displaySubmissionsTable();
        }
    });

    // Archives toggle
    const archivesToggle = document.getElementById('archives-toggle');
    const archivesContent = document.getElementById('archives-content');
    const toggleIcon = archivesToggle.querySelector('.toggle-icon');

    archivesToggle.addEventListener('click', () => {
        const isOpen = archivesContent.style.display !== 'none';
        archivesContent.style.display = isOpen ? 'none' : 'block';
        toggleIcon.textContent = isOpen ? '▶' : '▼';
    });

    // Refresh button
    document.getElementById('refresh-btn').addEventListener('click', async () => {
        notify.info('Actualisation', 'Rechargement des données...');
        await loadSubmissionsData();
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
        submissionsFilters.type = document.getElementById('filter-type').value;
        submissionsFilters.status = document.getElementById('filter-status').value;
        submissionsFilters.dateAfter = document.getElementById('filter-date-after').value;
        submissionsFilters.dateBefore = document.getElementById('filter-date-before').value;
        submissionsFilters.handled = document.getElementById('filter-handled').value;

        applySubmissionFilters();
        submissionsCurrentPage = 1;
        displaySubmissionsTable();

        filterOverlay.classList.remove('active');
        notify.success('Filtres appliqués', 'Les résultats ont été filtrés');
    });

    // Réinitialiser filtres
    document.getElementById('reset-filters').addEventListener('click', () => {
        resetSubmissionFilters();
    });

    // Modal submission
    initializeSubmissionModal();
}

// ========================================
// RECHERCHE
// ========================================

function handleSubmissionSearch(searchTerm) {
    searchTerm = searchTerm.toLowerCase().trim();

    if (!searchTerm) {
        submissionsFiltered = submissionsData.filter(s => {
            if (s.processed_by && s.processed_by !== subUser.id) {
                return false;
            }
            return true;
        });
        applySubmissionFilters();
    } else {
        submissionsFiltered = submissionsData.filter(sub => {
            // Ne pas montrer les dossiers pris en charge par d'autres
            if (sub.processed_by && sub.processed_by !== subUser.id) {
                return false;
            }

            return (
                sub.nom.toLowerCase().includes(searchTerm) ||
                sub.email.toLowerCase().includes(searchTerm) ||
                (sub.telephone && sub.telephone.includes(searchTerm))
            );
        });
    }

    sortSubmissionsData();
    submissionsCurrentPage = 1;
    displaySubmissionsTable();
}

// ========================================
// FILTRES
// ========================================

function applySubmissionFilters() {
    submissionsFiltered = submissionsData.filter(sub => {
        // Ne pas montrer les dossiers pris en charge par d'autres
        if (sub.processed_by && sub.processed_by !== subUser.id) {
            return false;
        }

        // Type
        if (submissionsFilters.type && sub.form_type !== submissionsFilters.type) {
            return false;
        }

        // Statut
        if (submissionsFilters.status && sub.status !== submissionsFilters.status) {
            return false;
        }

        // Date after
        if (submissionsFilters.dateAfter) {
            const subDate = new Date(sub.submitted_at);
            const filterDate = new Date(submissionsFilters.dateAfter);
            if (subDate < filterDate) return false;
        }

        // Date before
        if (submissionsFilters.dateBefore) {
            const subDate = new Date(sub.submitted_at);
            const filterDate = new Date(submissionsFilters.dateBefore);
            if (subDate > filterDate) return false;
        }

        // Pris en charge
        if (submissionsFilters.handled) {
            if (submissionsFilters.handled === 'yes' && !sub.processed_by) return false;
            if (submissionsFilters.handled === 'no' && sub.processed_by) return false;
            if (submissionsFilters.handled === 'me' && sub.processed_by !== subUser.id) return false;
        }

        return true;
    });

    sortSubmissionsData();
}

function resetSubmissionFilters() {
    submissionsFilters = {
        type: '',
        status: '',
        dateAfter: '',
        dateBefore: '',
        handled: ''
    };

    document.getElementById('filter-type').value = '';
    document.getElementById('filter-status').value = '';
    document.getElementById('filter-date-after').value = '';
    document.getElementById('filter-date-before').value = '';
    document.getElementById('filter-handled').value = '';

    submissionsFiltered = submissionsData.filter(s => {
        if (s.processed_by && s.processed_by !== subUser.id) {
            return false;
        }
        return true;
    });
    sortSubmissionsData();
    submissionsCurrentPage = 1;
    displaySubmissionsTable();

    notify.info('Filtres réinitialisés', 'Affichage de toutes les soumissions');
}

// ========================================
// MODAL SUBMISSION
// ========================================

let currentSubmissionId = null;

function initializeSubmissionModal() {
    const modalOverlay = document.getElementById('submission-modal-overlay');
    const closeBtn = document.getElementById('close-submission-modal');

    // Fermer avec le bouton X
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeSubmissionModal();
        });
    }

    // Fermer en cliquant sur l'overlay
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeSubmissionModal();
            }
        });
    }

    // Fermer avec Échap
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay && modalOverlay.classList.contains('active')) {
            closeSubmissionModal();
        }
    });

    // Bouton prendre en charge
    document.getElementById('btn-take-charge').addEventListener('click', async () => {
        await takeChargeOfSubmission(currentSubmissionId);
    });

    // Bouton archiver
    document.getElementById('btn-archive').addEventListener('click', () => {
        openArchiveConfirmation(currentSubmissionId);
    });

    // Bouton supprimer (dans le header)
    document.getElementById('delete-submission-btn').addEventListener('click', () => {
        openDeleteConfirmation(currentSubmissionId);
    });

    // Bouton ajouter note
    document.getElementById('add-note-btn').addEventListener('click', () => {
        openAddNotePopup();
    });
}

async function openSubmissionModal(submissionId) {
    currentSubmissionId = parseInt(submissionId);
    
    try {
        const response = await authManager.fetch(`${SUBMISSIONS_API_URL}/contact-submissions/${submissionId}`);

        if (!response.ok) {
            throw new Error('Erreur lors du chargement des détails');
        }

        const data = await response.json();
        
        if (data.success) {
            displaySubmissionDetails(data.submission);
            
            // Ouvrir le modal
            document.getElementById('submission-modal-overlay').classList.add('active');
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Error loading submission details:', error);
        notify.error('Erreur', 'Impossible de charger les détails de la soumission');
    }
}

function closeSubmissionModal() {
    document.getElementById('submission-modal-overlay').classList.remove('active');
    currentSubmissionId = null;
}

function displaySubmissionDetails(submission) {
    // Type badge
    const typeBadge = document.getElementById('modal-type-badge');
    typeBadge.textContent = getTypeLabel(submission.form_type);
    typeBadge.className = `submission-type-badge type-${submission.form_type}`;

    // Nom
    document.getElementById('modal-name').textContent = submission.nom;

    // Email
    document.getElementById('modal-email').textContent = submission.email;

    // Téléphone
    document.getElementById('modal-phone').textContent = submission.telephone || 'Non renseigné';

    // Date
    document.getElementById('modal-date').textContent = formatDate(submission.submitted_at);

    // Statut
    const statusEl = document.getElementById('modal-status');
    statusEl.textContent = getStatusLabel(submission.status);
    statusEl.className = `submission-status status-${submission.status}`;

    // Handler
    document.getElementById('modal-handler').textContent = submission.handler_name || 'Non assigné';

    // Boutons d'action
    const btnTakeCharge = document.getElementById('btn-take-charge');
    const btnArchive = document.getElementById('btn-archive');
    const btnDelete = document.getElementById('delete-submission-btn');

    // Si déjà pris en charge par l'utilisateur actuel
    if (submission.processed_by === subUser.id) {
        btnTakeCharge.style.display = 'none';
    } else if (submission.processed_by) {
        // Pris en charge par quelqu'un d'autre (ne devrait pas arriver car filtré)
        btnTakeCharge.disabled = true;
        btnTakeCharge.textContent = 'Déjà pris en charge';
    } else {
        btnTakeCharge.style.display = 'flex';
        btnTakeCharge.disabled = false;
    }

    // Afficher le bouton supprimer seulement si archivé
    if (submission.status === 'archived') {
        btnArchive.style.display = 'none';
        btnDelete.style.display = 'block';
    } else {
        btnArchive.style.display = 'flex';
        btnArchive.disabled = false;
        btnArchive.innerHTML = '<span>📦</span><span>Archiver</span>';
        btnDelete.style.display = 'none';
    }

    // Données spécifiques
    displaySpecificData(submission);

    // Notes internes
    displayNotes(submission.notes || '');
}

function displaySpecificData(submission) {
    const container = document.getElementById('specific-data');
    const formData = JSON.parse(submission.form_data);

    let html = '';

    switch (submission.form_type) {
        case 'recrutement':
            html = `
                <div class="data-item">
                    <span class="data-label">Expérience:</span>
                    <span class="data-value">${formData.experience || 'N/A'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Certifications:</span>
                    <span class="data-value">${formData.certifications || 'N/A'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Motivation:</span>
                    <span class="data-value">${formData.motivation || 'N/A'}</span>
                </div>
                ${formData.cv_base64 ? `
                <div class="data-item">
                    <span class="data-label">CV:</span>
                    <button class="btn-download-cv" onclick="downloadCV('${formData.cv_filename}', '${formData.cv_base64}')">
                        📄 Télécharger
                    </button>
                </div>
                ` : ''}
            `;
            break;

        case 'plainte':
            html = `
                <div class="data-item">
                    <span class="data-label">Client:</span>
                    <span class="data-value">${formData.client || 'N/A'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Référence:</span>
                    <span class="data-value">${formData.reference || 'N/A'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Date incident:</span>
                    <span class="data-value">${formData.date_incident || 'N/A'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Type:</span>
                    <span class="data-value">${formData.type_plainte || 'N/A'}</span>
                </div>
                <div class="data-item full-width">
                    <span class="data-label">Description:</span>
                    <p class="data-description">${formData.description || 'N/A'}</p>
                </div>
            `;
            break;

        case 'rdv':
            html = `
                <div class="data-item">
                    <span class="data-label">Entreprise:</span>
                    <span class="data-value">${formData.entreprise || 'N/A'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Type RDV:</span>
                    <span class="data-value">${formData.type_rdv || 'N/A'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Date souhaitée:</span>
                    <span class="data-value">${formData.date_souhaitee || 'N/A'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Heure souhaitée:</span>
                    <span class="data-value">${formData.heure_souhaitee || 'N/A'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Lieu:</span>
                    <span class="data-value">${formData.lieu || 'N/A'}</span>
                </div>
                <div class="data-item full-width">
                    <span class="data-label">Objet:</span>
                    <p class="data-description">${formData.objet || 'N/A'}</p>
                </div>
            `;
            break;
    }

    container.innerHTML = html;
}

function displayNotes(notes) {
    const notesList = document.getElementById('notes-list');
    
    if (!notes || notes.trim() === '') {
        notesList.innerHTML = '<div class="empty-notes">Aucune note interne</div>';
        return;
    }

    // Les notes sont stockées comme texte avec séparateur
    const notesArray = notes.split('\n---\n').filter(n => n.trim());
    
    notesList.innerHTML = notesArray.map((note, index) => `
        <div class="note-item">
            <div class="note-content">${escapeHtml(note)}</div>
        </div>
    `).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// TÉLÉCHARGER CV
// ========================================

window.downloadCV = function(filename, base64Data) {
    try {
        // Extraire le base64 pur (sans le préfixe data:application/pdf;base64,)
        const base64 = base64Data.includes('base64,') 
            ? base64Data.split('base64,')[1] 
            : base64Data;

        // Convertir base64 en blob
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });

        // Créer un lien de téléchargement
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'CV.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        notify.success('Téléchargement', 'Le CV a été téléchargé');
    } catch (error) {
        console.error('Download CV error:', error);
        notify.error('Erreur', 'Impossible de télécharger le CV');
    }
};

// ========================================
// PRENDRE EN CHARGE
// ========================================

async function takeChargeOfSubmission(submissionId) {
    try {
        const response = await authManager.fetch(`${SUBMISSIONS_API_URL}/contact-submissions/${submissionId}/take-charge`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la prise en charge');
        }

        const data = await response.json();
        
        if (data.success) {
            notify.success('Pris en charge', 'Vous êtes maintenant responsable de cette soumission');
            closeSubmissionModal();
            await loadSubmissionsData();
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Take charge error:', error);
        notify.error('Erreur', error.message || 'Impossible de prendre en charge');
    }
}

// ========================================
// ARCHIVER
// ========================================

function openArchiveConfirmation(submissionId) {
    const popup = document.createElement('div');
    popup.className = 'archive-confirmation-overlay';
    popup.innerHTML = `
        <div class="archive-confirmation-popup">
            <div class="archive-confirmation-header">
                <h3>📦 Archiver la soumission</h3>
                <button class="close-archive-confirmation" onclick="this.closest('.archive-confirmation-overlay').remove()">✕</button>
            </div>
            <div class="archive-confirmation-body">
                <p>Êtes-vous sûr de vouloir archiver cette soumission ?</p>
                <p style="color: #B0B0B0; font-size: 0.9rem; margin-top: 1rem;">
                    La soumission sera déplacée dans la section "Archives" et ne sera plus visible dans la liste principale.
                </p>
            </div>
            <div class="archive-confirmation-footer">
                <button class="btn-cancel" onclick="this.closest('.archive-confirmation-overlay').remove()">Annuler</button>
                <button class="btn-confirm-archive" id="confirm-archive-btn">Archiver</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    // Bouton confirmer
    const confirmBtn = document.getElementById('confirm-archive-btn');
    confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Archivage...';
        
        const success = await archiveSubmission(submissionId);
        
        if (success) {
            popup.remove();
        } else {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Archiver';
        }
    });
    
    // Fermer avec Escape
    popup.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            popup.remove();
        }
    });
}

async function archiveSubmission(submissionId) {
    try {
        const response = await authManager.fetch(`${SUBMISSIONS_API_URL}/contact-submissions/${submissionId}/archive`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error('Erreur lors de l\'archivage');
        }

        const data = await response.json();
        
        if (data.success) {
            notify.success('Archivé', 'La soumission a été archivée');
            closeSubmissionModal();
            await loadSubmissionsData();
            return true;
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Archive error:', error);
        notify.error('Erreur', error.message || 'Impossible d\'archiver');
        return false;
    }
}

// ========================================
// SUPPRIMER
// ========================================

function openDeleteConfirmation(submissionId) {
    const popup = document.createElement('div');
    popup.className = 'delete-confirmation-overlay';
    popup.innerHTML = `
        <div class="delete-confirmation-popup">
            <div class="delete-confirmation-header">
                <h3>⚠️ Supprimer la soumission</h3>
                <button class="close-delete-confirmation" onclick="this.closest('.delete-confirmation-overlay').remove()">✕</button>
            </div>
            <div class="delete-confirmation-body">
                <p><strong>ATTENTION :</strong> Cette action est irréversible !</p>
                <p>Vous êtes sur le point de supprimer définitivement cette soumission.</p>
                <p>Toutes les données seront perdues :</p>
                <ul>
                    <li>Informations de contact</li>
                    <li>CV et documents joints</li>
                    <li>Notes internes</li>
                    <li>Historique complet</li>
                </ul>
                <p style="color: #F44336; font-weight: 600; margin-top: 1.5rem;">
                    Êtes-vous absolument sûr de vouloir continuer ?
                </p>
            </div>
            <div class="delete-confirmation-footer">
                <button class="btn-cancel" onclick="this.closest('.delete-confirmation-overlay').remove()">Annuler</button>
                <button class="btn-confirm-delete" id="confirm-delete-btn">Supprimer définitivement</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    // Bouton confirmer
    const confirmBtn = document.getElementById('confirm-delete-btn');
    confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Suppression...';
        
        const success = await deleteSubmission(submissionId);
        
        if (success) {
            popup.remove();
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

async function deleteSubmission(submissionId) {
    try {
        const response = await authManager.fetch(`${SUBMISSIONS_API_URL}/contact-submissions/${submissionId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la suppression');
        }

        const data = await response.json();
        
        if (data.success) {
            notify.success('Supprimé', 'La soumission a été supprimée définitivement');
            closeSubmissionModal();
            await loadSubmissionsData();
            return true;
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Delete error:', error);
        notify.error('Erreur', error.message || 'Impossible de supprimer');
        return false;
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
                <h3>📝 Ajouter une Note Interne</h3>
                <button class="close-add-item" onclick="this.closest('.add-item-overlay').remove()">✕</button>
            </div>
            <div class="add-item-body">
                <label for="note-content">Note</label>
                <textarea 
                    id="note-content" 
                    placeholder="Saisir la note interne..." 
                    rows="6"
                    maxlength="2000"
                ></textarea>
                <div class="char-count">
                    <span id="note-char-count">0</span> / 2000 caractères
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
        
        const success = await addSubmissionNote(currentSubmissionId, content);
        
        if (success) {
            popup.remove();
            // Recharger le modal
            await openSubmissionModal(currentSubmissionId);
            notify.success('Note ajoutée', 'La note interne a été enregistrée');
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

async function addSubmissionNote(submissionId, note) {
    try {
        const response = await authManager.fetch(`${SUBMISSIONS_API_URL}/contact-submissions/${submissionId}/note`, {
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