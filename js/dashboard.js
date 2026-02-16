// ========================================
// DASHBOARD HANDLER
// ========================================

// Vérifier si l'utilisateur est connecté avec authManager
if (!authManager.requireAuth()) {
    // L'authManager gère automatiquement la redirection
    // On arrête l'exécution du script
    throw new Error('Non authentifié');
}

// Récupérer l'utilisateur via authManager
const dashUser = authManager.getUser();

// Afficher les infos de l'utilisateur
const userName = dashUser.name || dashUser.email;
const userBadge = dashUser.badge || dashUser.id || '0000';

// Mettre à jour le nom
const userNameEl = document.getElementById('user-name');
if (userNameEl) {
    userNameEl.textContent = userName;
}

// Mettre à jour le badge
const userBadgeEl = document.getElementById('user-badge');
if (userBadgeEl) {
    userBadgeEl.textContent = `Badge #${String(userBadge).padStart(4, '0')}`;
}

// Générer les initiales pour l'avatar
const initials = userName
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .substring(0, 2);

const avatarEl = document.getElementById('user-avatar');
if (avatarEl) {
    // Afficher les initiales par défaut
    avatarEl.textContent = initials;
    
    // Charger l'avatar depuis l'API si disponible
    loadUserAvatar();
}

// Fonction pour charger l'avatar de l'utilisateur
async function loadUserAvatar() {
    const EMPLOYEES_API_URL = 'https://eagle-security.charliemoimeme.workers.dev/api';
    const avatarEl = document.getElementById('user-avatar');
    
    if (!avatarEl || !dashUser.id) {
        return;
    }

    // Si on a déjà l'avatar_url dans dashUser
    if (dashUser.avatar_url) {
        avatarEl.innerHTML = `<img src="${dashUser.avatar_url}" alt="${dashUser.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        return;
    }

    // Sinon, charger depuis l'API
    try {
        const response = await authManager.fetch(`${EMPLOYEES_API_URL}/employees/${dashUser.id}`);

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.employee && data.employee.avatar_url) {
                avatarEl.innerHTML = `<img src="${data.employee.avatar_url}" alt="${data.employee.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
                
                // Mettre à jour le cache local
                const user = authManager.getUser();
                user.avatar_url = data.employee.avatar_url;
                localStorage.setItem('eagle_user', JSON.stringify(user));
            }
        }
    } catch (error) {
        console.error('Error loading user avatar:', error);
        // Garder les initiales en cas d'erreur
    }
}

// Bouton déconnexion (maintenant un lien avec image)
const logoutButton = document.getElementById('logout-btn');
if (logoutButton) {
    logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        notify.success('Déconnexion', 'À bientôt !');
        setTimeout(() => {
            authManager.logout(false); // false = pas de notification (déjà affichée)
        }, 1000);
    });
}

// Burger menu toggle (dashboard uniquement)
const dashboardBurger = document.getElementById('burger-menu');
const dashboardNav = document.querySelector('.dashboard-menu');

if (dashboardBurger && dashboardNav) {
    dashboardBurger.addEventListener('click', (e) => {
        e.stopPropagation();
        dashboardBurger.classList.toggle('active');
        dashboardNav.classList.toggle('active');
    });

    // Fermer le menu quand on clique sur un lien
    const navLinks = dashboardNav.querySelectorAll('a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            dashboardBurger.classList.remove('active');
            dashboardNav.classList.remove('active');
        });
    });

    // Fermer le menu si on clique en dehors
    document.addEventListener('click', (e) => {
        if (!dashboardBurger.contains(e.target) && !dashboardNav.contains(e.target)) {
            dashboardBurger.classList.remove('active');
            dashboardNav.classList.remove('active');
        }
    });
}

// Animation au chargement
window.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.dashboard-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        setTimeout(() => {
            card.style.transition = 'all 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });
});
