// ========================================
// CONTACT FORMS HANDLER
// ========================================

const WORKER_URL = 'https://eagle-security.charliemoimeme.workers.dev/api';

// ========================================
// FORM SWITCHING
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initializeFormSwitcher();
    initializeFormSubmissions();
});

function initializeFormSwitcher() {
    const formButtons = document.querySelectorAll('.form-selector-btn');
    const forms = document.querySelectorAll('.contact-form');

    formButtons.forEach(button => {
        button.addEventListener('click', () => {
            const formType = button.getAttribute('data-form');

            // Mettre à jour les boutons
            formButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Mettre à jour les formulaires
            forms.forEach(form => form.classList.remove('active'));
            const targetForm = document.getElementById(`form-${formType}`);
            if (targetForm) {
                targetForm.classList.add('active');
            }
        });
    });
}

// ========================================
// FORM SUBMISSIONS
// ========================================

function initializeFormSubmissions() {
    // Formulaire Recrutement
    const recrutementForm = document.getElementById('form-recrutement');
    if (recrutementForm) {
        recrutementForm.addEventListener('submit', handleRecrutementSubmit);
    }

    // Formulaire Plainte
    const plainteForm = document.getElementById('form-plainte');
    if (plainteForm) {
        plainteForm.addEventListener('submit', handlePlainteSubmit);
    }

    // Formulaire RDV
    const rdvForm = document.getElementById('form-rdv');
    if (rdvForm) {
        rdvForm.addEventListener('submit', handleRdvSubmit);
    }
}

// ========================================
// RECRUTEMENT
// ========================================

async function handleRecrutementSubmit(e) {
    e.preventDefault();
    console.log('Form submitted: Recrutement');

    const form = e.target;
    const submitBtn = form.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;

    // Validation
    const cvFile = document.getElementById('recru-cv').files[0];
    if (!cvFile) {
        notify.error('CV manquant', 'Veuillez joindre votre CV en PDF');
        return;
    }

    if (cvFile.type !== 'application/pdf') {
        notify.error('Format invalide', 'Le CV doit être au format PDF');
        return;
    }

    if (cvFile.size > 5 * 1024 * 1024) {
        notify.error('Fichier trop volumineux', 'Le CV ne doit pas dépasser 5 MB');
        return;
    }

    // Désactiver le bouton
    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours...';

    try {
        // Convertir le PDF en base64
        const cvBase64 = await fileToBase64(cvFile);

        // Préparer les données
        const formData = {
            form_type: 'recrutement',
            nom: form.querySelector('#recru-nom').value.trim(),
            email: form.querySelector('#recru-email').value.trim(),
            telephone: form.querySelector('#recru-tel').value.trim(),
            form_data: JSON.stringify({
                experience: form.querySelector('#recru-experience').value,
                certifications: form.querySelector('#recru-certifications').value.trim(),
                motivation: form.querySelector('#recru-motivation').value.trim(),
                cv_filename: cvFile.name,
                cv_base64: cvBase64
            })
        };

        console.log('Sending recrutement data:', { ...formData, form_data: 'JSON data' });

        // Envoyer au serveur
        const response = await fetch(`${WORKER_URL}/contact-submission`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();
        console.log('Server response:', data);

        if (data.success) {
            notify.success('Candidature envoyée', 'Nous avons bien reçu votre candidature. Nous vous contacterons prochainement.');
            form.reset();
        } else {
            throw new Error(data.message || 'Erreur lors de l\'envoi');
        }

    } catch (error) {
        console.error('Recrutement submission error:', error);
        notify.error('Erreur', error.message || 'Impossible d\'envoyer votre candidature');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// ========================================
// PLAINTE
// ========================================

async function handlePlainteSubmit(e) {
    e.preventDefault();
    console.log('Form submitted: Plainte');

    const form = e.target;
    const submitBtn = form.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours...';

    try {
        const formData = {
            form_type: 'plainte',
            nom: form.querySelector('#plainte-nom').value.trim(),
            email: form.querySelector('#plainte-email').value.trim(),
            telephone: form.querySelector('#plainte-tel').value.trim() || null,
            form_data: JSON.stringify({
                client: form.querySelector('#plainte-client').value,
                reference: form.querySelector('#plainte-ref').value.trim() || null,
                date_incident: form.querySelector('#plainte-date').value,
                type_plainte: form.querySelector('#plainte-type').value,
                description: form.querySelector('#plainte-description').value.trim()
            })
        };

        console.log('Sending plainte data:', formData);

        const response = await fetch(`${WORKER_URL}/contact-submission`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();
        console.log('Server response:', data);

        if (data.success) {
            notify.success('Plainte enregistrée', 'Votre plainte a été enregistrée. Nous la traiterons dans les plus brefs délais.');
            form.reset();
        } else {
            throw new Error(data.message || 'Erreur lors de l\'envoi');
        }

    } catch (error) {
        console.error('Plainte submission error:', error);
        notify.error('Erreur', error.message || 'Impossible d\'enregistrer votre plainte');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// ========================================
// RDV
// ========================================

async function handleRdvSubmit(e) {
    e.preventDefault();
    console.log('Form submitted: RDV');

    const form = e.target;
    const submitBtn = form.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours...';

    try {
        const formData = {
            form_type: 'rdv',
            nom: form.querySelector('#rdv-nom').value.trim(),
            email: form.querySelector('#rdv-email').value.trim(),
            telephone: form.querySelector('#rdv-tel').value.trim(),
            form_data: JSON.stringify({
                entreprise: form.querySelector('#rdv-entreprise').value.trim() || null,
                type_rdv: form.querySelector('#rdv-type').value,
                date_souhaitee: form.querySelector('#rdv-date').value,
                heure_souhaitee: form.querySelector('#rdv-heure').value,
                lieu: form.querySelector('#rdv-lieu').value,
                objet: form.querySelector('#rdv-message').value.trim()
            })
        };

        console.log('Sending RDV data:', formData);

        const response = await fetch(`${WORKER_URL}/contact-submission`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();
        console.log('Server response:', data);

        if (data.success) {
            notify.success('RDV demandé', 'Votre demande de rendez-vous a été envoyée. Nous vous confirmerons la disponibilité sous 24h.');
            form.reset();
        } else {
            throw new Error(data.message || 'Erreur lors de l\'envoi');
        }

    } catch (error) {
        console.error('RDV submission error:', error);
        notify.error('Erreur', error.message || 'Impossible d\'enregistrer votre demande');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// ========================================
// HELPERS
// ========================================

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}