// Simple form validation
class SimpleValidation {
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email) {
      return { valid: false, message: 'Email is required' };
    }
    
    if (!emailRegex.test(email)) {
      return { valid: false, message: 'Please enter a valid email address' };
    }
    
    return { valid: true };
  }
  
  static validatePassword(password) {
    if (!password) {
      return { valid: false, message: 'Password is required' };
    }
    
    if (password.length < 6) {
      return { valid: false, message: 'Password must be at least 6 characters' };
    }
    
    return { valid: true };
  }
  
  static validateTaskName(name) {
    if (!name || !name.trim()) {
      return { valid: false, message: 'Task name is required' };
    }
    
    if (name.trim().length < 2) {
      return { valid: false, message: 'Task name must be at least 2 characters' };
    }
    
    return { valid: true };
  }
  
  static validateTime(timeString) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    
    if (!timeString) {
      return { valid: false, message: 'Time is required' };
    }
    
    if (!timeRegex.test(timeString)) {
      return { valid: false, message: 'Please enter time in HH:MM format' };
    }
    
    return { valid: true };
  }
  
  static validateDuration(duration) {
    const durationNum = parseInt(duration);
    
    if (!duration || isNaN(durationNum)) {
      return { valid: false, message: 'Duration is required' };
    }
    
    if (durationNum < 1 || durationNum > 480) {
      return { valid: false, message: 'Duration must be between 1 and 480 minutes' };
    }
    
    return { valid: true };
  }
  
  static validatePriority(priority) {
    const priorityNum = parseInt(priority);
    
    if (!priority || isNaN(priorityNum)) {
      return { valid: false, message: 'Priority is required' };
    }
    
    if (priorityNum < 1 || priorityNum > 5) {
      return { valid: false, message: 'Priority must be between 1 and 5' };
    }
    
    return { valid: true };
  }
  
  static showValidationError(element, message) {
    // Remove any existing error
    this.clearValidationError(element);
    
    // Add error styling
    element.style.borderColor = '#dc3545';
    element.style.backgroundColor = '#fff5f5';
    
    // Show error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'validation-error';
    errorDiv.style.color = '#dc3545';
    errorDiv.style.fontSize = '12px';
    errorDiv.style.marginTop = '4px';
    errorDiv.textContent = message;
    
    element.parentNode.insertBefore(errorDiv, element.nextSibling);
  }
  
  static clearValidationError(element) {
    // Reset styling
    element.style.borderColor = '';
    element.style.backgroundColor = '';
    
    // Remove error message
    const existingError = element.parentNode.querySelector('.validation-error');
    if (existingError) {
      existingError.remove();
    }
  }
  
  static clearAllValidationErrors(form) {
    // Clear all validation errors in a form
    const inputs = form.querySelectorAll('input, textarea, select');
    inputs.forEach(input => this.clearValidationError(input));
  }
}

export { SimpleValidation };