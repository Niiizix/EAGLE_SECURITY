// ========================================
// NOTIFICATION SYSTEM
// ========================================

class NotificationManager {
    constructor() {
        this.container = document.getElementById('notification-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            document.body.appendChild(this.container);
        }
    }

    /**
     * Affiche une notification
     * @param {string} type - Type: 'success', 'error', 'warning', 'info', 'neutral'
     * @param {string} title - Titre de la notification
     * @param {string} message - Message de la notification
     * @param {number} duration - Durée en ms (0 = infini)
     */
    show(type = 'neutral', title, message, duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        const icon = this.getIcon(type);

        notification.innerHTML = `
            <div class="notification-icon">${icon}</div>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                ${message ? `<div class="notification-message">${message}</div>` : ''}
            </div>
            <button class="notification-close" aria-label="Fermer">×</button>
            ${duration > 0 ? `<div class="notification-progress" style="animation-duration: ${duration}ms;"></div>` : ''}
        `;

        this.container.appendChild(notification);

        // Bouton fermer
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => this.close(notification));

        // Auto-fermeture
        if (duration > 0) {
            setTimeout(() => this.close(notification), duration);
        }

        return notification;
    }

    /**
     * Ferme une notification
     */
    close(notification) {
        notification.classList.add('closing');
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 300);
    }

    /**
     * Récupère l'icône selon le type
     */
    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ',
            neutral: '●'
        };
        return icons[type] || icons.neutral;
    }

    // Méthodes raccourcis
    success(title, message, duration = 5000) {
        return this.show('success', title, message, duration);
    }

    error(title, message, duration = 7000) {
        return this.show('error', title, message, duration);
    }

    warning(title, message, duration = 6000) {
        return this.show('warning', title, message, duration);
    }

    info(title, message, duration = 5000) {
        return this.show('info', title, message, duration);
    }

    neutral(title, message, duration = 5000) {
        return this.show('neutral', title, message, duration);
    }

    /**
     * Ferme toutes les notifications
     */
    closeAll() {
        const notifications = this.container.querySelectorAll('.notification');
        notifications.forEach(notif => this.close(notif));
    }
}

// Instance globale
const notify = new NotificationManager();