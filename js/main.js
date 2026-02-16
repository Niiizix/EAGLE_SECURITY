// ========================================
// EAGLE SECURITY - MAIN JAVASCRIPT
// ========================================

// === BURGER MENU TOGGLE ===
const burgerMenu = document.querySelector('.burger-menu');
const navbarMenu = document.querySelector('.navbar-menu');

if (burgerMenu) {
    burgerMenu.addEventListener('click', () => {
        navbarMenu.classList.toggle('active');
        burgerMenu.classList.toggle('active');
    });

    // Close menu when clicking on a link
    const navLinks = document.querySelectorAll('.navbar-menu a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navbarMenu.classList.remove('active');
            burgerMenu.classList.remove('active');
        });
    });
}

// === ACTIVE NAVIGATION HIGHLIGHT ===
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
const navLinks = document.querySelectorAll('.navbar-menu a');

navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
        link.classList.add('active');
    }
});

// === SMOOTH SCROLL FOR ANCHOR LINKS ===
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// === CONTACT FORM SWITCHER ===
const formSelectorBtns = document.querySelectorAll('.form-selector-btn');
const contactForms = document.querySelectorAll('.contact-form');

formSelectorBtns.forEach((btn, index) => {
    btn.addEventListener('click', () => {
        // Remove active class from all buttons and forms
        formSelectorBtns.forEach(b => b.classList.remove('active'));
        contactForms.forEach(f => f.classList.remove('active'));
        
        // Add active class to clicked button and corresponding form
        btn.classList.add('active');
        contactForms[index].classList.add('active');
    });
});

// === FLIP CARDS CLICK ON MOBILE ===
const flipCards = document.querySelectorAll('.flip-card');

flipCards.forEach(card => {
    card.addEventListener('click', function() {
        // Toggle flip on mobile
        if (window.innerWidth <= 768) {
            this.classList.toggle('flipped');
            const inner = this.querySelector('.flip-card-inner');
            if (this.classList.contains('flipped')) {
                inner.style.transform = 'rotateY(180deg)';
            } else {
                inner.style.transform = 'rotateY(0deg)';
            }
        }
    });
});

// === FORM SUBMISSION (PLACEHOLDER) ===
const forms = document.querySelectorAll('form');

forms.forEach(form => {
    // Ignorer les formulaires de contact qui ont leurs propres handlers dans contact.js
    const formId = form.getAttribute('id');
    if (formId && (formId.includes('recrutement') || formId.includes('plainte') || formId.includes('rdv'))) {
        console.log('Skipping form handler for:', formId);
        return; // Ne pas ajouter de handler ici
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Placeholder for future integration
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        
        console.log('Form submitted:', data);
        
        // Show success message
        alert('Votre demande a été envoyée avec succès. Nous vous contacterons bientôt.');
        
        // Reset form
        form.reset();
    });
});

// === INTERSECTION OBSERVER FOR ANIMATIONS ===
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe all service cards and value items
const animatedElements = document.querySelectorAll('.service-card, .value-item, .flip-card');
animatedElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'all 0.6s ease-out';
    observer.observe(el);
});

// === COUNTER ANIMATION (for stats if needed) ===
function animateCounter(element, target, duration = 2000) {
    let current = 0;
    const increment = target / (duration / 16);
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 16);
}

// === LOADING ANIMATION ===
window.addEventListener('load', () => {
    document.body.classList.add('loaded');
});

// === PREVENT CONTEXT MENU ON IMAGES (optional security) ===
const images = document.querySelectorAll('img');
images.forEach(img => {
    img.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
});

// === PARALLAX EFFECT ON HERO ===
window.addEventListener('scroll', () => {
    const hero = document.querySelector('.hero');
    if (hero) {
        const scrolled = window.pageYOffset;
        const parallax = hero.querySelector('.hero-content');
        if (parallax) {
            parallax.style.transform = `translateY(${scrolled * 0.5}px)`;
        }
    }
});

// === CONSOLE WELCOME MESSAGE ===
console.log('%c🦅 EAGLE SECURITY', 'color: #6B7C8E; font-size: 24px; font-weight: bold;');
console.log('%cProtection d\'élite en Californie', 'color: #B0B0B0; font-size: 14px;');
console.log('%cDeveloped for GTA RP', 'color: #8B9AAD; font-size: 12px;');