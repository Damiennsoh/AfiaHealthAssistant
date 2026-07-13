// Enhanced error handling utilities for AI Assistant
export interface AIError {
  type: 'network' | 'api_key' | 'rate_limit' | 'model_error' | 'timeout' | 'unknown'
  message: string
  userMessage: string
  retryable: boolean
  retryAfter?: number // seconds
  details?: any
}

export function classifyAIError(error: any): AIError {
  // Handle structured error responses first
  if (error && typeof error === 'object') {
    // Rate limit errors
    if (error.status === 429 || error.code === 429) {
      return {
        type: 'rate_limit',
        message: error.message || 'Rate limit exceeded',
        userMessage: `Rate limit exceeded. Please wait ${error.retryAfter || 60} seconds before trying again.`,
        retryable: true,
        retryAfter: error.retryAfter || 60,
        details: error
      };
    }
    
    // API key errors
    if (error.status === 401 || error.code === 401 || error.message?.includes('API key')) {
      return {
        type: 'api_key',
        message: error.message || 'Invalid API key',
        userMessage: 'AI service configuration issue. Please contact your administrator.',
        retryable: false,
        details: error
      };
    }
    
    // Model not available
    if (error.status === 404 || error.code === 404 || error.message?.includes('model')) {
      return {
        type: 'model_error',
        message: error.message || 'Model not available',
        userMessage: 'AI model temporarily unavailable. Trying alternative models...',
        retryable: true,
        details: error
      };
    }
    
    // Network errors
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return {
        type: 'network',
        message: error.message || 'Network error',
        userMessage: 'Network connection issue. Please check your internet and try again.',
        retryable: true,
        retryAfter: 5,
        details: error
      };
    }
  }

  // Handle string errors
  const errorMessage = error?.message || String(error);
  
  // Rate limit detection in error message
  if (errorMessage.includes('quota') || errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
    return {
      type: 'rate_limit',
      message: errorMessage,
      userMessage: 'Rate limit exceeded. Please wait a moment before trying again.',
      retryable: true,
      retryAfter: 60,
      details: error
    };
  }

  // API key detection in error message
  if (errorMessage.includes('API key') || errorMessage.includes('authentication') || errorMessage.includes('unauthorized')) {
    return {
      type: 'api_key',
      message: errorMessage,
      userMessage: 'AI service configuration issue. Please contact your administrator.',
      retryable: false,
      details: error
    };
  }

  // Network detection in error message
  if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('connection')) {
    return {
      type: 'network',
      message: errorMessage,
      userMessage: 'Network connection issue. Please check your internet and try again.',
      retryable: true,
      retryAfter: 5,
      details: error
    };
  }

  // Timeout detection
  if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
    return {
      type: 'timeout',
      message: errorMessage,
      userMessage: 'Request timed out. Please try again.',
      retryable: true,
      retryAfter: 10,
      details: error
    };
  }

  // Default unknown error
  return {
    type: 'unknown',
    message: errorMessage,
    userMessage: 'An unexpected error occurred. Please try again.',
    retryable: true,
    details: error
  };
}

// Retry logic with exponential backoff
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      const aiError = classifyAIError(error)
      
      // Don't retry if not retryable or this is the last attempt
      if (!aiError.retryable || attempt === maxRetries) {
        throw aiError
      }
      
      // Calculate delay with exponential backoff
      let delay = baseDelay * Math.pow(2, attempt)
      
      // Use retryAfter if available (for rate limits)
      if (aiError.retryAfter) {
        delay = aiError.retryAfter * 1000
      }
      
      // Add jitter to avoid thundering herd
      delay += Math.random() * 1000
      
      console.warn(`AI request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(delay)}ms:`, (error as Error).message)
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}

// Network status detection
export function getNetworkStatus(): {
  online: boolean
  effectiveType?: string
  downlink?: number
  rtt?: number
} {
  if (typeof navigator === 'undefined') {
    return { online: true }
  }
  
  // Type assertion for navigator.connection (not in standard TypeScript types)
  const nav = navigator as any
  if (!nav.connection) {
    return { online: navigator.onLine }
  }
  
  const connection = nav.connection
  return {
    online: navigator.onLine,
    effectiveType: connection.effectiveType,
    downlink: connection.downlink,
    rtt: connection.rtt
  }
}

// Check if network is suitable for AI requests
export function isNetworkSuitableForAI(): boolean {
  const status = getNetworkStatus()
  
  if (!status.online) return false
  
  // Check if connection is too slow for reliable AI requests
  if (status.effectiveType && ['slow-2g', '2g'].includes(status.effectiveType)) {
    return false
  }
  
  return true
}
