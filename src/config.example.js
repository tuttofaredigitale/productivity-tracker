/**
 * PRODUCTIVITY TRACKER - CONFIGURATION
 * 
 * Copy this file to config.js and fill in your credentials:
 *   cp config.example.js config.js
 * 
 * IMPORTANT: config.js is in .gitignore - never commit your real credentials!
 */

const CONFIG = {
  // AWS API Gateway endpoint (get this after deploying your Lambda)
  // Example: 'https://abc123xyz.execute-api.eu-central-1.amazonaws.com/prod'
  API_URL: '',
  
  // Auto sync interval (minutes, 0 = disabled)
  AUTO_SYNC_INTERVAL: 5,
  
  // Minimum session duration to save (seconds)
  MIN_SESSION_DURATION: 60,
  
  // Default pomodoro duration (seconds)
  DEFAULT_POMODORO: 25 * 60,
  
  // Enable notifications
  NOTIFICATIONS_ENABLED: true,
  
  // Debug mode (enables console logging)
  DEBUG: false,

  // AI Providers Configuration
  // API keys are stored locally in the browser, not here
  AI_PROVIDERS: {
    anthropic: {
      name: 'Anthropic (Claude)',
      endpoint: 'https://api.anthropic.com/v1/messages',
      models: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
      defaultModel: 'claude-haiku-4-5-20251001',
      keyPlaceholder: 'sk-ant-...',
      docsUrl: 'https://console.anthropic.com/'
    },
    openai: {
      name: 'OpenAI (GPT)',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      models: ['gpt-5.2-2025-12-11', 'gpt-5-mini-2025-08-07'],
      defaultModel: 'gpt-5-mini-2025-08-07',
      keyPlaceholder: 'sk-...',
      docsUrl: 'https://platform.openai.com/api-keys'
    },
    groq: {
      name: 'Groq (Fast & Free tier)',
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'qwen/qwen3-32b'],
      defaultModel: 'llama-3.1-8b-instant',
      keyPlaceholder: 'gsk_...',
      docsUrl: 'https://console.groq.com/keys'
    },
    ollama: {
      name: 'Ollama (Local)',
      endpoint: 'http://localhost:11434/api/chat',
      models: ['llama3.2', 'mistral', 'codellama', 'phi3'],
      defaultModel: 'llama3.2',
      keyPlaceholder: '(not required)',
      docsUrl: 'https://ollama.ai/',
      local: true
    }
  }
};

if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}
