// ========================================
// AUTHENTICATION MANAGER
// Gestion centralisée de l'authentification avec auto-refresh
// ========================================

class AuthManager {
    constructor() {
        this.TOKEN_KEY = 'eagle_token';
        this.USER_KEY = 'eagle_user';
        this.LAST_ACTIVITY_KEY = 'eagle_last_activity';
        this.INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 heure en millisecondes
        this.CHECK_INTERVAL = 30 * 1000; // Vérifier toutes les 30 secondes
        this.REFRESH_BEFORE_EXPIRE = 10 * 60 * 1000; // Rafraîchir 10 min avant expiration
        this.WORKER_URL = 'https://eagle-security.charliemoimeme.workers.dev';
        
        this.activityTimer = null;
        this.checkTimer = null;
        
        // Démarrer la surveillance si on est connecté
        if (this.isAuthenticated()) {
            this.startActivityTracking();
            this.startTokenCheck();
        }
    }

    /**
     * Vérifier si l'utilisateur est authentifié
     */
    isAuthenticated() {
        const token = localStorage.getItem(this.TOKEN_KEY);
        const user = localStorage.getItem(this.USER_KEY);
        return !!(token && user);
    }

    /**
     * Récupérer le token
     */
    getToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    }

    /**
     * Récupérer les infos utilisateur
     */
    getUser() {
        const userStr = localStorage.getItem(this.USER_KEY);
        return userStr ? JSON.parse(userStr) : null;
    }

    /**
     * Sauvegarder la connexion
     */
    setAuth(token, user) {
        localStorage.setItem(this.TOKEN_KEY, token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        this.updateLastActivity();
        this.startActivityTracking();
        this.startTokenCheck();
    }

    /**
     * Déconnexion
     */
    logout(showNotification = true) {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
        localStorage.removeItem(this.LAST_ACTIVITY_KEY);
        
        this.stopActivityTracking();
        this.stopTokenCheck();
        
        if (showNotification && typeof notify !== 'undefined') {
            notify.info('Session expirée', 'Veuillez vous reconnecter.');
        }
        
        // Rediriger vers login
        window.location.href = 'login.html';
    }

    /**
     * Mettre à jour la dernière activité
     */
    updateLastActivity() {
        const now = Date.now();
        localStorage.setItem(this.LAST_ACTIVITY_KEY, now.toString());
    }

    /**
     * Récupérer le temps d'inactivité en ms
     */
    getInactivityTime() {
        const lastActivity = localStorage.getItem(this.LAST_ACTIVITY_KEY);
        if (!lastActivity) return this.INACTIVITY_TIMEOUT + 1; // Forcé expiré
        
        const now = Date.now();
        return now - parseInt(lastActivity, 10);
    }

    /**
     * Vérifier si le token a expiré (inactivité)
     */
    isTokenExpired() {
        return this.getInactivityTime() > this.INACTIVITY_TIMEOUT;
    }

    /**
     * Démarrer le tracking d'activité
     */
    startActivityTracking() {
        // Mettre à jour l'activité sur ces événements
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
        
        const updateActivity = () => {
            this.updateLastActivity();
        };

        events.forEach(event => {
            document.addEventListener(event, updateActivity, { passive: true });
        });

        // Sauvegarder les listeners pour pouvoir les retirer
        this._activityListeners = events.map(event => ({ event, handler: updateActivity }));
    }

    /**
     * Arrêter le tracking d'activité
     */
    stopActivityTracking() {
        if (this._activityListeners) {
            this._activityListeners.forEach(({ event, handler }) => {
                document.removeEventListener(event, handler);
            });
            this._activityListeners = null;
        }
    }

    /**
     * Démarrer la vérification périodique du token
     */
    startTokenCheck() {
        // Vérifier toutes les 30 secondes
        this.checkTimer = setInterval(() => {
            this.checkAndRefreshToken();
        }, this.CHECK_INTERVAL);
    }

    /**
     * Arrêter la vérification du token
     */
    stopTokenCheck() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }
    }

    /**
     * Vérifier et rafraîchir le token si nécessaire
     */
    async checkAndRefreshToken() {
        if (!this.isAuthenticated()) {
            return;
        }

        const inactivityTime = this.getInactivityTime();

        // Si inactif depuis trop longtemps, déconnecter
        if (inactivityTime > this.INACTIVITY_TIMEOUT) {
            console.log('Token expiré par inactivité');
            this.logout(true);
            return;
        }

        // Si proche de l'expiration et actif récemment, rafraîchir le token
        const timeUntilExpire = this.INACTIVITY_TIMEOUT - inactivityTime;
        if (timeUntilExpire < this.REFRESH_BEFORE_EXPIRE) {
            console.log('Rafraîchissement du token...');
            await this.refreshToken();
        }
    }

    /**
     * Rafraîchir le token via l'API
     */
    async refreshToken() {
        try {
            const token = this.getToken();
            if (!token) return;

            const response = await fetch(`${this.WORKER_URL}/api/refresh-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.token) {
                    // Mettre à jour le token
                    localStorage.setItem(this.TOKEN_KEY, data.token);
                    this.updateLastActivity();
                    console.log('Token rafraîchi avec succès');
                }
            } else if (response.status === 401) {
                // Token invalide, déconnecter
                console.log('Token invalide, déconnexion...');
                this.logout(true);
            }
        } catch (error) {
            console.error('Erreur lors du rafraîchissement du token:', error);
        }
    }

    /**
     * Faire une requête authentifiée
     * Gère automatiquement l'expiration du token
     */
    async fetch(url, options = {}) {
        const token = this.getToken();
        
        if (!token) {
            throw new Error('Non authentifié');
        }

        // Vérifier l'expiration avant la requête
        if (this.isTokenExpired()) {
            this.logout(true);
            throw new Error('Session expirée');
        }

        // Ajouter le token aux headers
        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        try {
            const response = await fetch(url, { ...options, headers });

            // Si 401, le token est invalide
            if (response.status === 401) {
                console.log('Token invalide (401), déconnexion...');
                this.logout(true);
                throw new Error('Session expirée');
            }

            // Mettre à jour l'activité si la requête a réussi
            if (response.ok) {
                this.updateLastActivity();
            }

            return response;
        } catch (error) {
            console.error('Erreur lors de la requête authentifiée:', error);
            throw error;
        }
    }

    /**
     * Protéger une page (rediriger si non connecté)
     */
    requireAuth() {
        if (!this.isAuthenticated()) {
            if (typeof notify !== 'undefined') {
                notify.warning('Accès refusé', 'Veuillez vous connecter.');
            }
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
            return false;
        }

        if (this.isTokenExpired()) {
            this.logout(true);
            return false;
        }

        return true;
    }

    /**
     * Rediriger si déjà connecté (pour page login)
     */
    redirectIfAuthenticated() {
        if (this.isAuthenticated() && !this.isTokenExpired()) {
            if (typeof notify !== 'undefined') {
                notify.info('Déjà connecté', 'Redirection...');
            }
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
            return true;
        }
        return false;
    }
}

// Instance globale
const authManager = new AuthManager();
