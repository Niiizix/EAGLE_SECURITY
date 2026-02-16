// ========================================
// DATETIME UTILITIES - TIMEZONE MANAGEMENT
// Fuseau horaire: Europe/Brussels (UTC+1/UTC+2)
// ========================================

/**
 * Configuration du fuseau horaire
 * Bruxelles: UTC+1 en hiver, UTC+2 en été
 */
const TIMEZONE = 'Europe/Brussels';

/**
 * Classe de gestion centralisée des dates
 */
class DateTimeManager {
    constructor(timezone = TIMEZONE) {
        this.timezone = timezone;
    }

    /**
     * Convertir une date UTC de la BDD en date locale
     * @param {string} utcDateString - Date en format ISO ou SQL
     * @returns {Date} Date en fuseau horaire local
     */
    fromUTC(utcDateString) {
        if (!utcDateString) return null;
        
        // Si la date contient déjà 'Z' ou '+', c'est déjà en UTC
        if (!utcDateString.includes('Z') && !utcDateString.includes('+')) {
            // Ajouter 'Z' pour indiquer que c'est UTC
            utcDateString = utcDateString.replace(' ', 'T') + 'Z';
        }
        
        return new Date(utcDateString);
    }

    /**
     * Convertir une date locale en UTC pour la BDD
     * @param {Date} localDate - Date locale
     * @returns {string} Date en format ISO UTC
     */
    toUTC(localDate = new Date()) {
        return localDate.toISOString();
    }

    /**
     * Formatter une date UTC de la BDD en format français local
     * @param {string} utcDateString - Date UTC de la BDD
     * @param {object} options - Options de formatage
     * @returns {string} Date formatée en français (Europe/Brussels)
     */
    format(utcDateString, options = {}) {
        if (!utcDateString) return 'N/A';

        const date = this.fromUTC(utcDateString);
        if (!date || isNaN(date.getTime())) return 'N/A';

        const defaultOptions = {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: this.timezone,
            ...options
        };

        return date.toLocaleString('fr-FR', defaultOptions);
    }

    /**
     * Formatter en date courte (sans heure)
     * @param {string} utcDateString - Date UTC de la BDD
     * @returns {string} Format: DD/MM/YYYY
     */
    formatDate(utcDateString) {
        if (!utcDateString) return 'N/A';

        const date = this.fromUTC(utcDateString);
        if (!date || isNaN(date.getTime())) return 'N/A';

        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: this.timezone
        });
    }

    /**
     * Formatter en date longue (sans heure)
     * @param {string} utcDateString - Date UTC de la BDD
     * @returns {string} Format: 16 février 2026
     */
    formatDateLong(utcDateString) {
        if (!utcDateString) return 'N/A';

        const date = this.fromUTC(utcDateString);
        if (!date || isNaN(date.getTime())) return 'N/A';

        return date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: this.timezone
        });
    }

    /**
     * Formatter en heure seulement
     * @param {string} utcDateString - Date UTC de la BDD
     * @returns {string} Format: HH:MM
     */
    formatTime(utcDateString) {
        if (!utcDateString) return 'N/A';

        const date = this.fromUTC(utcDateString);
        if (!date || isNaN(date.getTime())) return 'N/A';

        return date.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: this.timezone
        });
    }

    /**
     * Formatter de manière relative (il y a X minutes/heures/jours)
     * @param {string} utcDateString - Date UTC de la BDD
     * @returns {string} Format relatif en français
     */
    formatRelative(utcDateString) {
        if (!utcDateString) return 'Jamais';

        const date = this.fromUTC(utcDateString);
        if (!date || isNaN(date.getTime())) return 'Jamais';

        const now = new Date();
        const diffMs = now - date;
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSeconds < 60) {
            return 'À l\'instant';
        } else if (diffMinutes < 60) {
            return `Il y a ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
        } else if (diffHours < 24) {
            return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
        } else if (diffDays < 7) {
            return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
        } else if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return `Il y a ${weeks} semaine${weeks > 1 ? 's' : ''}`;
        } else if (diffDays < 365) {
            const months = Math.floor(diffDays / 30);
            return `Il y a ${months} mois`;
        } else {
            const years = Math.floor(diffDays / 365);
            return `Il y a ${years} an${years > 1 ? 's' : ''}`;
        }
    }

    /**
     * Obtenir la date actuelle en format ISO UTC (pour envoyer à la BDD)
     * @returns {string} Date actuelle en ISO UTC
     */
    now() {
        return this.toUTC(new Date());
    }

    /**
     * Obtenir la date actuelle formatée en français
     * @returns {string} Date actuelle formatée
     */
    nowFormatted() {
        return this.format(this.now());
    }

    /**
     * Vérifier si une date est aujourd'hui
     * @param {string} utcDateString - Date UTC de la BDD
     * @returns {boolean}
     */
    isToday(utcDateString) {
        if (!utcDateString) return false;

        const date = this.fromUTC(utcDateString);
        if (!date || isNaN(date.getTime())) return false;

        const today = new Date();
        
        // Comparer les dates en tenant compte du fuseau horaire
        const dateLocal = new Date(date.toLocaleString('en-US', { timeZone: this.timezone }));
        const todayLocal = new Date(today.toLocaleString('en-US', { timeZone: this.timezone }));

        return (
            dateLocal.getDate() === todayLocal.getDate() &&
            dateLocal.getMonth() === todayLocal.getMonth() &&
            dateLocal.getFullYear() === todayLocal.getFullYear()
        );
    }

    /**
     * Vérifier si une date est cette semaine
     * @param {string} utcDateString - Date UTC de la BDD
     * @returns {boolean}
     */
    isThisWeek(utcDateString) {
        if (!utcDateString) return false;

        const date = this.fromUTC(utcDateString);
        if (!date || isNaN(date.getTime())) return false;

        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        return diffDays >= 0 && diffDays < 7;
    }

    /**
     * Vérifier si une date est ce mois-ci
     * @param {string} utcDateString - Date UTC de la BDD
     * @returns {boolean}
     */
    isThisMonth(utcDateString) {
        if (!utcDateString) return false;

        const date = this.fromUTC(utcDateString);
        if (!date || isNaN(date.getTime())) return false;

        const today = new Date();
        
        const dateLocal = new Date(date.toLocaleString('en-US', { timeZone: this.timezone }));
        const todayLocal = new Date(today.toLocaleString('en-US', { timeZone: this.timezone }));

        return (
            dateLocal.getMonth() === todayLocal.getMonth() &&
            dateLocal.getFullYear() === todayLocal.getFullYear()
        );
    }

    /**
     * Calculer la différence en jours entre maintenant et une date
     * @param {string} utcDateString - Date UTC de la BDD
     * @returns {number} Nombre de jours (négatif si dans le passé)
     */
    daysFromNow(utcDateString) {
        if (!utcDateString) return null;

        const date = this.fromUTC(utcDateString);
        if (!date || isNaN(date.getTime())) return null;

        const now = new Date();
        const diffMs = date - now;
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    /**
     * Formatter pour un input datetime-local HTML
     * @param {string} utcDateString - Date UTC de la BDD
     * @returns {string} Format: YYYY-MM-DDTHH:MM
     */
    toInputValue(utcDateString) {
        if (!utcDateString) return '';

        const date = this.fromUTC(utcDateString);
        if (!date || isNaN(date.getTime())) return '';

        // Convertir en fuseau horaire local
        const localDate = new Date(date.toLocaleString('en-US', { timeZone: this.timezone }));
        
        const year = localDate.getFullYear();
        const month = String(localDate.getMonth() + 1).padStart(2, '0');
        const day = String(localDate.getDate()).padStart(2, '0');
        const hours = String(localDate.getHours()).padStart(2, '0');
        const minutes = String(localDate.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    /**
     * Convertir une valeur d'input datetime-local en UTC
     * @param {string} inputValue - Valeur de l'input (YYYY-MM-DDTHH:MM)
     * @returns {string} Date en ISO UTC
     */
    fromInputValue(inputValue) {
        if (!inputValue) return null;

        // Créer une date en considérant que l'input est en fuseau horaire local
        const localDate = new Date(inputValue);
        return this.toUTC(localDate);
    }
}

// Instance globale
const dateTime = new DateTimeManager();

// Export pour utilisation
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DateTimeManager, dateTime, TIMEZONE };
}
