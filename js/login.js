// ========================================
// LOGIN HANDLER + CLOUDFLARE WORKER
// ========================================

const loginForm = document.getElementById('login-form');
const submitBtn = document.getElementById('login-submit');

// URL de ton Cloudflare Worker
const WORKER_URL = 'https://eagle-security.charliemoimeme.workers.dev/api/login';

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Validation basique
    if (!email || !password) {
        notify.warning('Champs incomplets', 'Veuillez remplir tous les champs.');
        return;
    }

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        notify.error('Email invalide', 'Veuillez entrer une adresse email valide.');
        return;
    }

    // Loading state
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');

    try {
        const response = await fetch(WORKER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Succès
            notify.success('Connexion réussie', `Bienvenue ${data.user.name} !`);
            
            // Utiliser authManager pour stocker les infos
            authManager.setAuth(data.token, data.user);

            // Redirection après 1.5s
            setTimeout(() => {
                window.location.href = data.redirect || 'dashboard.html';
            }, 1500);

        } else {
            // Erreur serveur
            notify.error(
                'Échec de connexion',
                data.message || 'Email ou mot de passe incorrect.'
            );
        }

    } catch (error) {
        // Erreur réseau
        console.error('Login error:', error);
        notify.error(
            'Erreur de connexion',
            'Impossible de contacter le serveur. Vérifiez votre connexion.'
        );
    } finally {
        // Reset loading state
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
    }
});

// Protection: si déjà connecté, rediriger
window.addEventListener('DOMContentLoaded', () => {
    authManager.redirectIfAuthenticated();
});