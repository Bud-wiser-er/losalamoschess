/**
 * =============================================================================
 * REGISTRATION PAGE FUNCTIONALITY
 * =============================================================================
 * 
 * PURPOSE: External JavaScript file for registration page
 * LOCATION: Save as /frontend/js/registration.js
 * 
 * This file handles:
 * - Form validation
 * - Backend API integration  
 * - UI interactions (password toggle, character counters)
 * - Success notifications and redirects
 */

// ========================================================================
// UI FUNCTIONALITY (Character counters, password toggle, modal)
// ========================================================================

// Character counters
function setupCounter(id, counterId, max) {
  const input = document.getElementById(id);
  const counter = document.getElementById(counterId);
  input.addEventListener('input', () => {
    counter.textContent = `${input.value.length} / ${max}`;
    if (input.value.length >= max) {
      counter.classList.add("max");
    } else {
      counter.classList.remove("max");
    }
  });
}

// Toggle password visibility
function togglePassword(id, el) {
  const input = document.getElementById(id);
  if (input.type === "password") {
    input.type = "text";
    el.textContent = "🙈"; // hidden eye
  } else {
    input.type = "password";
    el.textContent = "👁"; // open eye
  }
}

// Password strength checker
function initPasswordStrength() {
  const passwordInput = document.getElementById('password');
  const strengthText = document.getElementById('strengthText');
  
  passwordInput.addEventListener('input', () => {
    const val = passwordInput.value;
    let strength = "";
    let cls = "";

    if (val.length === 0) {
      strengthText.textContent = "";
      strengthText.className = "password-strength";
      return;
    }

    if (val.length >= 8 && /[A-Z]/.test(val) && /[a-z]/.test(val) && /\d/.test(val) && /[^A-Za-z0-9]/.test(val)) {
      strength = "Very Strong";
      cls = "strong";
    } else if (val.length >= 8 && /[A-Z]/.test(val) && /[a-z]/.test(val) && /\d/.test(val)) {
      strength = "Strong";
      cls = "strong";
    } else if (val.length >= 6 && ((/[A-Z]/.test(val) && /[a-z]/.test(val)) || (/[A-Za-z]/.test(val) && /\d/.test(val)))) {
      strength = "Medium";
      cls = "medium";
    } else {
      strength = "Weak";
      cls = "weak";
    }

    strengthText.textContent = `Strength: ${strength}`;
    strengthText.className = `password-strength ${cls}`;
  });
}

// Modal functionality
function initModal() {
  const termsLink = document.getElementById('termsLink');
  const termsModal = document.getElementById('termsModal');
  const closeModal = document.getElementById('closeModal');

  termsLink.addEventListener('click', (e) => {
    e.preventDefault();
    termsModal.style.display = "flex";
  });

  closeModal.addEventListener('click', () => {
    termsModal.style.display = "none";
  });

  window.addEventListener('click', (e) => {
    if (e.target === termsModal) {
      termsModal.style.display = "none";
    }
  });
}

// ========================================================================
// BACKEND INTEGRATION AND FORM SUBMISSION
// ========================================================================

/**
 * Handle registration errors from server
 */
function handleRegistrationError(result) {
  const error = result.error || 'Registration failed';
  
  if (error.toLowerCase().includes('email') || error.toLowerCase().includes('already exists')) {
    showFieldError('emailError', 'This email is already registered');
  } else if (error.toLowerCase().includes('username')) {
    showFieldError('usernameError', 'This username is already taken');
  } else {
    showNotification(`❌ Registration failed: ${error}`, 'error');
  }
}

/**
 * Show field-specific error(keeps textbox visible)
 */
function showFieldError(errorId, message) {
  const errorElement = document.getElementById(errorId);
  const inputId = errorId.replace('Error', '');
  const inputElement = document.getElementById(inputId);
  
  if (errorElement && inputElement) {
    errorElement.textContent = message;
    errorElement.classList.add('show');
    inputElement.classList.add('error');
    
    // Keep the input value, just add error styling
    // Don't clear the input - user can see what they typed
    inputElement.focus(); // Focus the field with error
  }
}

/**
 * Clear all error states
 */
function clearAllErrors() {
  document.querySelectorAll('.error').forEach(el => {
    el.classList.remove('show');
  });
  document.querySelectorAll('input').forEach(input => {
    input.classList.remove('error');
    // Don't clear input values - keep what user typed
  });
}
/**
 * Clear specific field error when user starts typing - NEW FUNCTION
 */
function clearFieldErrorOnInput(inputElement, errorElement) {
  inputElement.addEventListener('input', () => {
    if (errorElement.classList.contains('show')) {
      errorElement.classList.remove('show');
      inputElement.classList.remove('error');
    }
  });
}

/**
 * Set button loading state
 */
function setButtonLoading(isLoading) {
  const submitButton = document.getElementById('registerBtn');
  if (isLoading) {
    submitButton.disabled = true;
    submitButton.textContent = 'Creating Account...';
    submitButton.style.opacity = '0.7';
  } else {
    submitButton.disabled = false;
    submitButton.textContent = 'Register';
    submitButton.style.opacity = '1';
  }
}

/**
 * Show notification popup
 */
function showNotification(message, type) {
  // Remove existing notifications
  const existing = document.querySelector('.temp-notification');
  if (existing) {
    existing.remove();
  }

  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'temp-notification';

  // Set colors based on type
  if (type === 'success') {
    notification.style.background = 'linear-gradient(135deg, #10b981, #059669)';
  } else if (type === 'error') {
    notification.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
  } else {
    notification.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
  }

  notification.textContent = message;
  document.body.appendChild(notification);

  // Auto remove notification after 5 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOutToRight 0.3s ease-in';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  }, 5000);
}

/**
 * Main form submission handler
 */
async function handleFormSubmission(e) {
  e.preventDefault();
  
  console.log('🔄 Form submitted, starting validation...');
  
  // Clear previous errors
  clearAllErrors(); // Only removes error classes, keeps values
  

  const username = document.getElementById('username').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const terms = document.getElementById('terms').checked;

  let valid = true;

  // Client-side validation
  if (!username) {
    showFieldError('usernameError', 'Username is required.');
    valid = false;
  } else if (username.length < 3) {
    showFieldError('usernameError', 'Username must be at least 3 characters.');
    valid = false;
  }

  if (!email.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)) {
    showFieldError('emailError', 'Please enter a valid email address.');
    valid = false;
  }

  if (!password) {
    showFieldError('passwordError', 'Password is required.');
    valid = false;
  } else if (password.length < 8) {
    showFieldError('passwordError', 'Password must be at least 8 characters long.');
    
    valid = false;
  } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    showFieldError('passwordError', 'Password must contain uppercase, lowercase, and a number.');
    valid = false;
  }

  if (password !== confirmPassword) {
    showFieldError('confirmError', 'Passwords do not match.');
    valid = false;
  }

  if (!terms) {
    showFieldError('termsError', 'You must accept the terms to continue.');
    valid = false;
  }

  if (!valid) {
    console.log('❌ Client-side validation failed');
    return;
  }

  console.log('✅ Client-side validation passed');

  // Show loading state
  setButtonLoading(true);

  try {
    console.log('🔄 Sending registration request to /api/auth/register...');
    
    // Send registration request to backend
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: username,
        email: email,
        password: password
      })
    });

    const result = await response.json();
    console.log('📨 Server response:', result);

    if (response.ok) {
      // Registration successful!
      console.log('✅ Registration successful:', result);
      
      // Show success notification
      showNotification('✅ Account created successfully! Redirecting to login...', 'success');
      
      // Store user info temporarily for login page
      sessionStorage.setItem('registeredEmail', email);
      sessionStorage.setItem('registeredUsername', username);
      
      // Redirect to login page after 2 seconds
      setTimeout(() => {
        window.location.href = 'login_page.html';
      }, 2000);
      
    } else {
      // Registration failed
      console.error('❌ Registration failed:', result);
      handleRegistrationError(result);
    }

  } catch (error) {
    console.error('❌ Network error during registration:', error);
    showNotification('❌ Network error. Please check your connection and try again.', 'error');
  } finally {
    // Reset button state
    setButtonLoading(false);
  }
}

// ========================================================================
// INITIALIZATION - UPDATED WITH ERROR CLEARING
// ========================================================================

document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Registration page loaded');
  
  // Initialize UI components
  setupCounter("username", "usernameCounter", 20);
  setupCounter("email", "emailCounter", 50);
  setupCounter("password", "passwordCounter", 30);
  setupCounter("confirmPassword", "confirmCounter", 30);
  
  // Initialize password strength checker
  initPasswordStrength();
  
  // Initialize modal
  initModal();
  
  // NEW: Set up real-time error clearing when user starts typing
  const inputErrorPairs = [
    ['username', 'usernameError'],
    ['email', 'emailError'], 
    ['password', 'passwordError'],
    ['confirmPassword', 'confirmError']
  ];
  
  inputErrorPairs.forEach(([inputId, errorId]) => {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);
    if (input && error) {
      clearFieldErrorOnInput(input, error);
    }
  });
  
  // Clear terms error when checkbox is clicked
  const termsCheckbox = document.getElementById('terms');
  const termsError = document.getElementById('termsError');
  if (termsCheckbox && termsError) {
    termsCheckbox.addEventListener('change', () => {
      if (termsCheckbox.checked && termsError.classList.contains('show')) {
        termsError.classList.remove('show');
      }
    });
  }
  
  // Attach form submission handler
  const form = document.getElementById('registerForm');
  if (form) {
    form.addEventListener('submit', handleFormSubmission);
    console.log('✅ Form event listener attached');
  } else {
    console.error('❌ Registration form not found');
  }
  
  console.log('✅ Registration page initialized successfully');
});