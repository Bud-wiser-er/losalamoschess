// common/ui.js
// UI utilities and state management for Los Alamos Chess

/**
 * UI State Management
 */
class UIState {
    constructor() {
        this.notifications = [];
        this.loading = false;
        this.currentPage = '';
        this.gameState = null;
        this.listeners = new Map();
    }
    
    /**
     * Subscribe to state changes
     * @param {string} event - Event name
     * @param {function} callback - Callback function
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }
    
    /**
     * Emit state change event
     * @param {string} event - Event name
     * @param {any} data - Event data
     */
    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => callback(data));
        }
    }
    
    /**
     * Update game state
     * @param {Object} newState - New game state
     */
    updateGameState(newState) {
        this.gameState = { ...this.gameState, ...newState };
        this.emit('gameStateChanged', this.gameState);
    }
}

// Global UI state instance
const uiState = new UIState();

/**
 * Notification Types
 */
export const NOTIFICATION_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
};

/**
 * Show notification message
 * @param {string} message - Message to display
 * @param {string} type - Notification type
 * @param {number} duration - Auto-hide duration in ms (0 = no auto-hide)
 */
export function showNotification(message, type = NOTIFICATION_TYPES.INFO, duration = 5000) {
    const notification = createNotificationElement(message, type);
    document.body.appendChild(notification);
    
    // Store in state
    uiState.notifications.push({
        id: notification.id,
        message,
        type,
        timestamp: Date.now()
    });
    
    // Auto-hide if duration is set
    if (duration > 0) {
        setTimeout(() => {
            hideNotification(notification.id);
        }, duration);
    }
    
    // Animate in
    requestAnimationFrame(() => {
        notification.classList.add('show');
    });
    
    return notification.id;
}

/**
 * Show error message
 * @param {string} message - Error message
 * @param {number} duration - Auto-hide duration
 */
export function showError(message, duration = 7000) {
    return showNotification(message, NOTIFICATION_TYPES.ERROR, duration);
}

/**
 * Show success message
 * @param {string} message - Success message
 * @param {number} duration - Auto-hide duration
 */
export function showSuccess(message, duration = 4000) {
    return showNotification(message, NOTIFICATION_TYPES.SUCCESS, duration);
}

/**
 * Show warning message
 * @param {string} message - Warning message
 * @param {number} duration - Auto-hide duration
 */
export function showWarning(message, duration = 6000) {
    return showNotification(message, NOTIFICATION_TYPES.WARNING, duration);
}

/**
 * Show info message
 * @param {string} message - Info message
 * @param {number} duration - Auto-hide duration
 */
export function showInfo(message, duration = 5000) {
    return showNotification(message, NOTIFICATION_TYPES.INFO, duration);
}

/**
 * Hide notification by ID
 * @param {string} notificationId - Notification ID
 */
export function hideNotification(notificationId) {
    const notification = document.getElementById(notificationId);
    if (notification) {
        notification.classList.add('hide');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }
    
    // Remove from state
    uiState.notifications = uiState.notifications.filter(n => n.id !== notificationId);
}

/**
 * Clear all notifications
 */
export function clearAllNotifications() {
    uiState.notifications.forEach(notification => {
        hideNotification(notification.id);
    });
}

/**
 * Clear error messages specifically
 */
export function clearError() {
    const errorNotifications = uiState.notifications.filter(n => n.type === NOTIFICATION_TYPES.ERROR);
    errorNotifications.forEach(notification => {
        hideNotification(notification.id);
    });
}

/**
 * Create notification DOM element
 * @param {string} message - Message text
 * @param {string} type - Notification type
 * @returns {HTMLElement} Notification element
 */
function createNotificationElement(message, type) {
    const notification = document.createElement('div');
    notification.id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    notification.className = `notification notification-${type}`;
    
    const icon = getNotificationIcon(type);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'notification-close';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = () => hideNotification(notification.id);
    
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${icon}</span>
            <span class="notification-message">${escapeHtml(message)}</span>
        </div>
    `;
    notification.appendChild(closeBtn);
    
    return notification;
}

/**
 * Get icon for notification type
 * @param {string} type - Notification type
 * @returns {string} Icon HTML
 */
function getNotificationIcon(type) {
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    return icons[type] || icons.info;
}

/**
 * Loading State Management
 */

/**
 * Show loading spinner
 * @param {string} message - Loading message
 * @param {HTMLElement} container - Container element (optional)
 */
export function showLoading(message = 'Loading...', container = null) {
    uiState.loading = true;
    
    const loader = createLoadingElement(message);
    
    if (container) {
        container.appendChild(loader);
    } else {
        document.body.appendChild(loader);
    }
    
    requestAnimationFrame(() => {
        loader.classList.add('show');
    });
    
    return loader.id;
}

/**
 * Hide loading spinner
 * @param {string} loaderId - Loader ID (optional)
 */
export function hideLoading(loaderId = null) {
    uiState.loading = false;
    
    if (loaderId) {
        const loader = document.getElementById(loaderId);
        if (loader) {
            loader.classList.add('hide');
            setTimeout(() => {
                if (loader.parentNode) {
                    loader.parentNode.removeChild(loader);
                }
            }, 300);
        }
    } else {
        // Hide all loaders
        const loaders = document.querySelectorAll('.loading-overlay');
        loaders.forEach(loader => {
            loader.classList.add('hide');
            setTimeout(() => {
                if (loader.parentNode) {
                    loader.parentNode.removeChild(loader);
                }
            }, 300);
        });
    }
}

/**
 * Create loading element
 * @param {string} message - Loading message
 * @returns {HTMLElement} Loading element
 */
function createLoadingElement(message) {
    const loader = document.createElement('div');
    loader.id = `loader-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    loader.className = 'loading-overlay';
    
    loader.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <div class="loading-message">${escapeHtml(message)}</div>
        </div>
    `;
    
    return loader;
}

/**
 * Form Utilities
 */

/**
 * Validate form fields
 * @param {HTMLFormElement} form - Form element
 * @param {Object} rules - Validation rules
 * @returns {Object} Validation result
 */
export function validateForm(form, rules = {}) {
    const formData = new FormData(form);
    const errors = {};
    let isValid = true;
    
    for (const [fieldName, rule] of Object.entries(rules)) {
        const value = formData.get(fieldName);
        const fieldErrors = validateField(value, rule);
        
        if (fieldErrors.length > 0) {
            errors[fieldName] = fieldErrors;
            isValid = false;
            
            // Show field error
            showFieldError(form.querySelector(`[name="${fieldName}"]`), fieldErrors[0]);
        } else {
            // Clear field error
            clearFieldError(form.querySelector(`[name="${fieldName}"]`));
        }
    }
    
    return { isValid, errors, data: Object.fromEntries(formData) };
}

/**
 * Validate individual field
 * @param {any} value - Field value
 * @param {Object} rule - Validation rule
 * @returns {Array} Array of error messages
 */
function validateField(value, rule) {
    const errors = [];
    
    // Required validation
    if (rule.required && (!value || value.trim() === '')) {
        errors.push(rule.requiredMessage || 'This field is required');
        return errors; // Stop further validation if required field is empty
    }
    
    // Skip other validations if field is empty and not required
    if (!value || value.trim() === '') {
        return errors;
    }
    
    // Minimum length
    if (rule.minLength && value.length < rule.minLength) {
        errors.push(rule.minLengthMessage || `Minimum length is ${rule.minLength} characters`);
    }
    
    // Maximum length
    if (rule.maxLength && value.length > rule.maxLength) {
        errors.push(rule.maxLengthMessage || `Maximum length is ${rule.maxLength} characters`);
    }
    
    // Email validation
    if (rule.email && !isValidEmail(value)) {
        errors.push(rule.emailMessage || 'Please enter a valid email address');
    }
    
    // Pattern validation
    if (rule.pattern && !rule.pattern.test(value)) {
        errors.push(rule.patternMessage || 'Invalid format');
    }
    
    // Custom validation
    if (rule.custom && typeof rule.custom === 'function') {
        const customResult = rule.custom(value);
        if (customResult !== true) {
            errors.push(customResult || 'Invalid value');
        }
    }
    
    return errors;
}

/**
 * Show field error
 * @param {HTMLElement} field - Form field element
 * @param {string} message - Error message
 */
function showFieldError(field, message) {
    if (!field) return;
    
    // Remove existing error
    clearFieldError(field);
    
    // Add error class
    field.classList.add('field-error');
    
    // Create error element
    const errorElement = document.createElement('div');
    errorElement.className = 'field-error-message';
    errorElement.textContent = message;
    
    // Insert after field
    field.parentNode.insertBefore(errorElement, field.nextSibling);
}

/**
 * Clear field error
 * @param {HTMLElement} field - Form field element
 */
function clearFieldError(field) {
    if (!field) return;
    
    field.classList.remove('field-error');
    
    const errorElement = field.parentNode.querySelector('.field-error-message');
    if (errorElement) {
        errorElement.remove();
    }
}

/**
 * Board UI Utilities
 */

/**
 * Update chess board display
 * @param {Object} gameState - Current game state
 * @param {HTMLElement} boardElement - Board container element
 */
export function updateBoard(gameState, boardElement) {
    if (!gameState || !boardElement) return;
    
    // Clear existing pieces
    const squares = boardElement.querySelectorAll('.chess-square');
    squares.forEach(square => {
        square.innerHTML = '';
        square.className = 'chess-square';
    });
    
    // Place pieces according to game state
    if (gameState.board) {
        gameState.board.forEach((row, rowIndex) => {
            row.forEach((piece, colIndex) => {
                if (piece) {
                    const square = boardElement.querySelector(`[data-row="${rowIndex}"][data-col="${colIndex}"]`);
                    if (square) {
                        square.innerHTML = getPieceSymbol(piece);
                        square.classList.add(`piece-${piece.color}`);
                    }
                }
            });
        });
    }
    
    // Highlight current player's turn
    boardElement.classList.toggle('white-turn', gameState.currentPlayer === 'white');
    boardElement.classList.toggle('black-turn', gameState.currentPlayer === 'black');
    
    // Show check state
    if (gameState.inCheck) {
        boardElement.classList.add('in-check');
    } else {
        boardElement.classList.remove('in-check');
    }
}

/**
 * Get piece symbol for display
 * @param {Object} piece - Piece object
 * @returns {string} Unicode chess symbol
 */
function getPieceSymbol(piece) {
    const symbols = {
        white: {
            king: '♔',
            queen: '♕',
            rook: '♖',
            bishop: '♗',
            knight: '♘',
            pawn: '♙'
        },
        black: {
            king: '♚',
            queen: '♛',
            rook: '♜',
            bishop: '♝',
            knight: '♞',
            pawn: '♟'
        }
    };
    
    return symbols[piece.color]?.[piece.type] || '';
}

/**
 * Highlight legal moves
 * @param {Array} legalMoves - Array of legal move positions
 * @param {HTMLElement} boardElement - Board container
 */
export function highlightLegalMoves(legalMoves, boardElement) {
    // Clear existing highlights
    const squares = boardElement.querySelectorAll('.chess-square');
    squares.forEach(square => {
        square.classList.remove('legal-move', 'capture-move');
    });
    
    // Highlight legal moves
    legalMoves.forEach(move => {
        const square = boardElement.querySelector(`[data-row="${move.row}"][data-col="${move.col}"]`);
        if (square) {
            square.classList.add(move.isCapture ? 'capture-move' : 'legal-move');
        }
    });
}

/**
 * Utility Functions
 */

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Is valid email
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Debounce function calls
 * @param {function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function calls
 * @param {function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {function} Throttled function
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Initialize notification styles
function initializeNotificationStyles() {
    if (document.getElementById('notification-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            min-width: 300px;
            max-width: 500px;
            padding: 16px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            transform: translateX(100%);
            opacity: 0;
            transition: all 0.3s ease;
        }
        
        .notification.show {
            transform: translateX(0);
            opacity: 1;
        }
        
        .notification.hide {
            transform: translateX(100%);
            opacity: 0;
        }
        
        .notification-success { background: #10b981; }
        .notification-error { background: #ef4444; }
        .notification-warning { background: #f59e0b; }
        .notification-info { background: #3b82f6; }
        
        .notification-content {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .notification-close {
            position: absolute;
            top: 8px;
            right: 8px;
            background: none;
            border: none;
            color: white;
            font-size: 18px;
            cursor: pointer;
            padding: 4px;
        }
        
        .loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        
        .loading-overlay.show {
            opacity: 1;
        }
        
        .loading-overlay.hide {
            opacity: 0;
        }
        
        .loading-spinner {
            background: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 16px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .field-error {
            border-color: #ef4444 !important;
            box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1) !important;
        }
        
        .field-error-message {
            color: #ef4444;
            font-size: 14px;
            margin-top: 4px;
        }
        
        .chess-square.legal-move {
            background-color: rgba(34, 197, 94, 0.3) !important;
        }
        
        .chess-square.capture-move {
            background-color: rgba(239, 68, 68, 0.3) !important;
        }
    `;
    document.head.appendChild(style);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNotificationStyles);
} else {
    initializeNotificationStyles();
}

// Export UI state for advanced usage
export { uiState };

// Default export
export default {
    showNotification,
    showError,
    showSuccess,
    showWarning,
    showInfo,
    hideNotification,
    clearAllNotifications,
    clearError,
    showLoading,
    hideLoading,
    validateForm,
    updateBoard,
    highlightLegalMoves,
    debounce,
    throttle,
    uiState,
    NOTIFICATION_TYPES
};