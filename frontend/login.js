/**
 * LOGIN JAVASCRIPT FOR LOS ALAMOS CHESS
 * 
 * Purpose: Handle user login, store authentication data, redirect to dashboard
 * File Location: /frontend/login.js
 * 
 * Input: Login form submission (email, password)
 * Output: JWT tokens in localStorage, user data storage, dashboard redirect
 */

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Login page loaded');
    
    // Get form elements
    const loginForm = document.getElementById('loginForm') || document.querySelector('form');
    const emailInput = document.getElementById('email') || document.querySelector('input[type="email"]');
    const passwordInput = document.getElementById('password') || document.querySelector('input[type="password"]');
    const submitButton = document.getElementById('loginBtn') || document.querySelector('button[type="submit"]');
    
    // Add event listener to form
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Check if user is already logged in
    checkExistingLogin();
});

/**
 * Handle login form submission
 * @param {Event} event - Form submit event
 */
async function handleLogin(event) {
    event.preventDefault();
    
    // Get form elements
    const emailInput = document.getElementById('email') || document.querySelector('input[type="email"]');
    const passwordInput = document.getElementById('password') || document.querySelector('input[type="password"]');
    const submitButton = document.getElementById('loginBtn') || document.querySelector('button[type="submit"]');
    
    // Get form data
    const email = emailInput?.value?.trim();
    const password = passwordInput?.value;
    
    // Validate input
    if (!email || !password) {
        showError('Please enter both email and password');
        return;
    }
    
    // Show loading state
    setLoadingState(true);
    clearMessages();
    
    try {
        // Send login request to server
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.accessToken) {
            // Login successful
            console.log('Login successful:', result.user.username);
            
            // Store authentication data in localStorage
            localStorage.setItem('accessToken', result.accessToken);
            localStorage.setItem('refreshToken', result.refreshToken);
            
            // Store user data for game view
            localStorage.setItem('username', result.user.username);
            localStorage.setItem('rating', result.user.rating);
            localStorage.setItem('userId', result.user.id);
            localStorage.setItem('email', result.user.email);
            
            // Store login timestamp
            localStorage.setItem('loginTime', Date.now().toString());
            
            // Show success message
            showSuccess(`Welcome back, ${result.user.username}!`);
            
            // Redirect to dashboard after short delay
            setTimeout(() => {
                window.location.href = '/dashboard_page.html';
            }, 1500);
            
        } else {
            // Login failed
            showError(result.error || 'Login failed. Please check your credentials.');
        }
        
    } catch (error) {
        console.error('Login error:', error);
        showError('Network error. Please check your connection and try again.');
    } finally {
        setLoadingState(false);
    }
}

/**
 * Check if user is already logged in
 */
function checkExistingLogin() {
    const accessToken = localStorage.getItem('accessToken');
    const username = localStorage.getItem('username');
    
    if (accessToken && username) {
        // User appears to be logged in
        showInfo(`Already logged in as ${username}. Redirecting...`);
        setTimeout(() => {
            window.location.href = '/dashboard_page.html';
        }, 2000);
    }
}

/**
 * Set loading state for login button
 * @param {boolean} loading - Whether to show loading state
 */
function setLoadingState(loading) {
    const submitButton = document.getElementById('loginBtn') || document.querySelector('button[type="submit"]');
    const emailInput = document.getElementById('email') || document.querySelector('input[type="email"]');
    const passwordInput = document.getElementById('password') || document.querySelector('input[type="password"]');
    
    if (submitButton) {
        if (loading) {
            submitButton.disabled = true;
            submitButton.textContent = 'Logging in...';
            submitButton.style.opacity = '0.6';
        } else {
            submitButton.disabled = false;
            submitButton.textContent = 'Login';
            submitButton.style.opacity = '1';
        }
    }
    
    // Disable inputs during loading
    if (emailInput) emailInput.disabled = loading;
    if (passwordInput) passwordInput.disabled = loading;
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
    // Try to find existing error container
    let errorContainer = document.getElementById('error-message') || 
                        document.querySelector('.error-message') ||
                        document.querySelector('.alert-danger');
    
    // Create error container if it doesn't exist
    if (!errorContainer) {
        errorContainer = createMessageContainer('error');
    }
    
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
    errorContainer.className = 'error-message alert alert-danger';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (errorContainer) {
            errorContainer.style.display = 'none';
        }
    }, 5000);
}

/**
 * Show success message
 * @param {string} message - Success message to display
 */
function showSuccess(message) {
    let successContainer = document.getElementById('success-message') ||
                          document.querySelector('.success-message') ||
                          document.querySelector('.alert-success');
    
    if (!successContainer) {
        successContainer = createMessageContainer('success');
    }
    
    successContainer.textContent = message;
    successContainer.style.display = 'block';
    successContainer.className = 'success-message alert alert-success';
}

/**
 * Show info message
 * @param {string} message - Info message to display
 */
function showInfo(message) {
    let infoContainer = document.getElementById('info-message') ||
                       document.querySelector('.info-message') ||
                       document.querySelector('.alert-info');
    
    if (!infoContainer) {
        infoContainer = createMessageContainer('info');
    }
    
    infoContainer.textContent = message;
    infoContainer.style.display = 'block';
    infoContainer.className = 'info-message alert alert-info';
}

/**
 * Create message container if it doesn't exist
 * @param {string} type - Type of message container
 * @returns {HTMLElement} Created message container
 */
function createMessageContainer(type) {
    const container = document.createElement('div');
    container.id = `${type}-message`;
    container.style.cssText = `
        padding: 10px 15px;
        margin: 10px 0;
        border-radius: 5px;
        display: none;
        font-weight: 500;
    `;
    
    // Set colors based on type
    switch (type) {
        case 'error':
            container.style.backgroundColor = '#f8d7da';
            container.style.color = '#721c24';
            container.style.border = '1px solid #f5c6cb';
            break;
        case 'success':
            container.style.backgroundColor = '#d4edda';
            container.style.color = '#155724';
            container.style.border = '1px solid #c3e6cb';
            break;
        case 'info':
            container.style.backgroundColor = '#d1ecf1';
            container.style.color = '#0c5460';
            container.style.border = '1px solid #bee5eb';
            break;
    }
    
    // Insert at top of form or body
    const form = document.querySelector('form');
    const insertTarget = form || document.body;
    
    if (form) {
        form.insertBefore(container, form.firstChild);
    } else {
        insertTarget.appendChild(container);
    }
    
    return container;
}

/**
 * Clear all message containers
 */
function clearMessages() {
    const messages = document.querySelectorAll('.error-message, .success-message, .info-message, .alert');
    messages.forEach(msg => {
        msg.style.display = 'none';
    });
}

/**
 * Utility function to validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Whether email is valid
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Clear stored authentication data (for logout)
 */
function clearAuthData() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('username');
    localStorage.removeItem('rating');
    localStorage.removeItem('userId');
    localStorage.removeItem('email');
    localStorage.removeItem('loginTime');
}

// Export functions for potential use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        handleLogin,
        clearAuthData,
        showError,
        showSuccess,
        isValidEmail
    };
}