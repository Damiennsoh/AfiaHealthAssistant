/**
 * AFIA Health Assistant - API Client
 * Replaces Firebase SDK calls with REST API calls to self-hosted backend
 */

// Get API base URL - must work in both SSR and client contexts
function getAPIBase(): string {
  // In Next.js, process.env.NEXT_PUBLIC_* variables are available at build time
  // and are inlined into the JavaScript bundle
  if (typeof window === 'undefined') {
    // Server-side (should not reach here since this is a client-side API)
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  }
  
  // Client-side: use the inlined value from build time
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
}

const API_BASE = getAPIBase();

interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Exponential backoff delay
function getRetryDelay(retryCount: number): number {
  return Math.min(RETRY_DELAY_MS * Math.pow(2, retryCount), 10000);
}

// Wait function
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class AfiaAPI {
  private token: string | null = null;
  private refreshToken: string | null = null;
  private countryCode: string = 'GH';

  constructor() {
    // Load from localStorage on client side
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('afia_access_token');
      this.refreshToken = localStorage.getItem('afia_refresh_token');
      this.countryCode = localStorage.getItem('afia_country') || 'GH';
    }
  }

  /**
   * Set country context from clinic configuration
   * This determines which knowledge base is queried (GH-STG or EDLIZ)
   */
  setCountry(code: 'GH' | 'ZW') {
    this.countryCode = code;
    if (typeof window !== 'undefined') {
      localStorage.setItem('afia_country', code);
    }
  }

  /**
   * Get current country code
   */
  getCountry(): string {
    return this.countryCode;
  }

  /**
   * Set authentication tokens
   */
  setTokens(accessToken: string, refreshToken: string) {
    this.token = accessToken;
    this.refreshToken = refreshToken;
    if (typeof window !== 'undefined') {
      localStorage.setItem('afia_access_token', accessToken);
      localStorage.setItem('afia_refresh_token', refreshToken);
    }
  }

  /**
   * Clear authentication tokens (logout)
   */
  clearTokens() {
    this.token = null;
    this.refreshToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('afia_access_token');
      localStorage.removeItem('afia_refresh_token');
      localStorage.removeItem('afia_country');
    }
  }

  /**
   * Make authenticated API request with retries
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Country-Code': this.countryCode,
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle token expiration
      if (response.status === 401) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed && retryCount < MAX_RETRIES) {
          // Retry with new token
          return this.request(endpoint, options, retryCount + 1);
        }
        // Refresh failed, clear tokens
        this.clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return {
          error: 'Session expired',
          status: 401
        };
      }

      // Handle rate limiting
      if (response.status === 429 && retryCount < MAX_RETRIES) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : getRetryDelay(retryCount);
        console.warn(`Rate limited, retrying after ${delay}ms`);
        await wait(delay);
        return this.request(endpoint, options, retryCount + 1);
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          error: data.error || data.detail || `HTTP ${response.status}`,
          status: response.status,
        };
      }

      return {
        data: data as T,
        status: response.status,
      };
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        console.warn(`Request failed, retrying (${retryCount + 1}/${MAX_RETRIES}):`, error);
        await wait(getRetryDelay(retryCount));
        return this.request(endpoint, options, retryCount + 1);
      }
      console.error('API request failed:', error);
      return {
        error: error instanceof Error ? error.message : 'Network error',
        status: 0,
      };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.setTokens(data.access_token, this.refreshToken!);
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    return false;
  }

  // =========================================================================
  // AUTHENTICATION
  // =========================================================================

  async login(email: string, password: string, clinicId?: string, staffId?: string, department?: string, role?: string) {
    const response = await this.request<{
      access_token: string;
      refresh_token: string;
      user: { id: string; email: string; name: string; role: string; clinic_id?: string; country_code?: string; staff_id?: string; department?: string };
    }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, clinic_id: clinicId, staff_id: staffId, department: department, role: role }),
    });

    if (response.data) {
      this.setTokens(response.data.access_token, response.data.refresh_token);
      // Set country from user context
      if (response.data.user.country_code) {
        this.setCountry(response.data.user.country_code as 'GH' | 'ZW');
      }
    }

    return response;
  }

  // =========================================================================
  // CLINICS (Public Discovery)
  // =========================================================================

  async listPublicClinics(countryCode?: 'GH' | 'ZW', search?: string) {
    const params = new URLSearchParams();
    if (countryCode) params.append('country_code', countryCode);
    if (search) params.append('search', search);
    return this.request<Array<{
      id: string;
      name: string;
      code: string;
      country_code: string;
      region?: string;
      district?: string;
      is_active: boolean;
      require_staff_id: boolean;
      require_department: boolean;
      features: Record<string, any>;
    }>>(`/api/v1/clinics/public?${params.toString()}`);
  }

  async getPublicClinicByCode(clinicCode: string) {
    return this.request<{
      id: string;
      name: string;
      code: string;
      country_code: string;
      region?: string;
      district?: string;
      is_active: boolean;
      require_staff_id: boolean;
      require_department: boolean;
      features: Record<string, any>;
    }>(`/api/v1/clinics/public/${encodeURIComponent(clinicCode)}`);
  }

  async logout() {
    await this.request('/api/v1/auth/logout', { method: 'POST' });
    this.clearTokens();
  }

  async getCurrentUser() {
    return this.request<{
      id: string;
      email: string;
      full_name: string;
      role: string;
      clinic_id?: string;
      country_code?: string;
      staff_id?: string;
      department?: string;
    }>('/api/v1/auth/me');
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request('/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
  }

  // =========================================================================
  // PATIENTS
  // =========================================================================

  async createPatient(data: {
    full_name: string;
    date_of_birth: string;
    gender: string;
    phone?: string;
    address?: string;
    id_type?: string;
    id_number?: string;
    emergency_name?: string;
    emergency_phone?: string;
    emergency_relationship?: string;
    insurance_type?: string;
    insurance_number?: string;
    insurance_expiry?: string;
    blood_type?: string;
    allergies?: string[];
    chronic_conditions?: string[];
    clinic_id?: string;
  }) {
    return this.request('/api/v1/patients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPatient(folderNumber: string) {
    return this.request(`/api/v1/patients/${folderNumber}`);
  }

  async searchPatients(query: string, clinicId?: string) {
    const params = new URLSearchParams({ q: query });
    if (clinicId) params.append('clinic_id', clinicId);
    return this.request(`/api/v1/patients/search?${params.toString()}`);
  }

  async listPatients(clinicId?: string, skip = 0, limit = 50) {
    const params = new URLSearchParams();
    if (clinicId) params.append('clinic_id', clinicId);
    params.append('skip', skip.toString());
    params.append('limit', limit.toString());
    return this.request(`/api/v1/patients?${params.toString()}`);
  }

  async updatePatient(patientId: string, data: Partial<typeof this.createPatient>) {
    return this.request(`/api/v1/patients/${patientId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // =========================================================================
  // ENCOUNTERS (SOAP NOTES)
  // =========================================================================

  async createEncounter(data: {
    patient_id: string;
    clinic_id: string;
    encounter_date: string;
    encounter_type?: string;
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    vitals?: {
      bp?: string;
      pulse?: number;
      temperature?: number;
      weight?: number;
      height?: number;
      bmi?: number;
      spo2?: number;
      respiratory_rate?: number;
    };
    primary_diagnosis?: string;
    secondary_diagnoses?: string[];
    icd10_codes?: string[];
    prescriptions?: Array<{
      drug: string;
      dose: string;
      frequency: string;
      duration: string;
      instructions?: string;
    }>;
    procedures?: string[];
    lab_orders?: string[];
    lab_results?: Record<string, any>;
    referral_to?: string;
    referral_reason?: string;
    follow_up_date?: string;
    follow_up_instructions?: string;
  }) {
    return this.request('/api/v1/encounters', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getEncounters(patientId?: string, skip = 0, limit = 50) {
    const params = new URLSearchParams();
    if (patientId) params.append('patient_id', patientId);
    params.append('skip', skip.toString());
    params.append('limit', limit.toString());
    return this.request(`/api/v1/encounters?${params.toString()}`);
  }

  async getEncounter(encounterId: string) {
    return this.request(`/api/v1/encounters/${encounterId}`);
  }

  async updateEncounter(encounterId: string, data: Partial<typeof this.createEncounter>) {
    return this.request(`/api/v1/encounters/${encounterId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // =========================================================================
  // KNOWLEDGE BASE (RAG) - THE KEY ENDPOINT
  // =========================================================================

  /**
   * Query medical knowledge base
   * Automatically uses the country set by setCountry() (GH or ZW)
   * Override with X-Country-Code header
   */
  async queryKnowledge(
    query: string,
    options?: {
      filters?: Record<string, any>;
      topK?: number;
      includeMetadata?: boolean;
      countryCode?: 'GH' | 'ZW'; // Override country for this query
    }
  ) {
    // Temporarily override country if specified
    const originalCountry = this.countryCode;
    if (options?.countryCode) {
      this.countryCode = options.countryCode;
    }

    const response = await this.request<{
      country_code: string;
      knowledge_base: string;
      query: string;
      total_results: number;
      results: Array<{
        text: string;
        source: string;
        metadata: Record<string, any>;
        confidence: number;
        citation: string;
      }>;
      query_time_ms: number;
      mode: string;
    }>('/api/v1/knowledge/query', {
      method: 'POST',
      body: JSON.stringify({
        query,
        filters: options?.filters || {},
        top_k: options?.topK || 10,
        include_metadata: options?.includeMetadata !== false,
      }),
    });

    // Restore original country
    this.countryCode = originalCountry;

    return response;
  }

  async getKnowledgeBaseInfo(countryCode?: 'GH' | 'ZW') {
    const cc = countryCode || this.countryCode;
    return this.request(`/api/v1/knowledge/bases/${cc}`);
  }

  async listKnowledgeBases() {
    return this.request('/api/v1/knowledge/bases');
  }

  // =========================================================================
  // CLINICS (Admin only)
  // =========================================================================

  async listClinics() {
    return this.request('/api/v1/clinics');
  }

  async createClinic(data: {
    name: string;
    code: string;
    country_code: 'GH' | 'ZW';
    address?: string;
    city?: string;
    region?: string;
    district?: string;
    phone?: string;
    email?: string;
    facility_level?: string;
    ghs_facility_code?: string;
    nhis_facility_id?: string;
    mohcc_facility_code?: string;
    admin_email: string;
    admin_name: string;
    admin_password: string;
    require_staff_id?: boolean;
    require_department?: boolean;
  }) {
    return this.request('/api/v1/clinics', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getClinic(clinicId: string) {
    return this.request<{
      id: string;
      name: string;
      code: string;
      country_code: string;
      address?: string;
      city?: string;
      region?: string;
      district?: string;
      phone?: string;
      email?: string;
      facility_level?: string;
      require_staff_id: boolean;
      require_department: boolean;
      features: Record<string, any>;
    }>(`/api/v1/clinics/${clinicId}`);
  }

  async updateClinic(clinicId: string, data: Partial<typeof this.createClinic>) {
    return this.request(`/api/v1/clinics/${clinicId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // =========================================================================
  // SYNC (Offline Support)
  // =========================================================================

  async pushSyncChanges(changes: Array<{
    action: string;
    resource_type: string;
    resource_id: string;
    payload?: Record<string, any>;
  }>, deviceId: string) {
    return this.request('/api/v1/sync/push', {
      method: 'POST',
      body: JSON.stringify({ changes, device_id: deviceId }),
    });
  }

  async getPendingSync(deviceId: string) {
    return this.request(`/api/v1/sync/pending?device_id=${deviceId}`);
  }

  async acknowledgeSync(syncId: string, success = true, error?: string) {
    return this.request('/api/v1/sync/ack', {
      method: 'POST',
      body: JSON.stringify({ sync_id: syncId, success, error }),
    });
  }

  // =========================================================================
  // USERS (Admin only)
  // =========================================================================

  async listUsers(clinicId?: string) {
    const params = new URLSearchParams();
    if (clinicId) params.append('clinic_id', clinicId);
    return this.request(`/api/v1/users?${params.toString()}`);
  }

  async createUser(data: {
    email: string;
    full_name: string;
    password: string;
    role: string;
    clinic_id?: string;
    staff_id?: string;
    department?: string;
  }) {
    return this.request('/api/v1/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(userId: string, data: Partial<typeof this.createUser>) {
    return this.request(`/api/v1/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deactivateUser(userId: string, options?: { reason?: string }) {
    return this.request(`/api/v1/users/${userId}`, { 
      method: 'DELETE',
      body: options?.reason ? JSON.stringify({ reason: options.reason }) : undefined
    });
  }

  // =========================================================================
  // HEALTH CHECK
  // =========================================================================

  async healthCheck() {
    return this.request('/api/v1/health');
  }
}

// Singleton instance
export const afiaAPI = new AfiaAPI();
export default afiaAPI;
