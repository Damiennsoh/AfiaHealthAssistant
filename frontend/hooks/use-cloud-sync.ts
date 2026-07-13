"use client";

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Cloud Sync Hook
 * Manages cloud-based sync using a relay server
 * In production, this would connect to Firestore or similar
 */

export type CloudSyncStatus = 'idle' | 'creating' | 'awaiting' | 'downloading' | 'uploading' | 'complete' | 'error';

interface CloudSyncState {
  status: CloudSyncStatus;
  code: string | null;
  progress: number;
  expiresAt: Date | null;
  error: string | null;
}

interface SyncSession {
  code: string;
  data: any;
  expiresAt: string;
  createdAt: string;
}

export function useCloudSync() {
  const [state, setState] = useState<CloudSyncState>({
    status: 'idle',
    code: null,
    progress: 0,
    expiresAt: null,
    error: null
  });

  // Generate a unique sync code
  const generateCode = useCallback((): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }, []);

  // Create a sync session (sender)
  const createSession = useCallback(async (data: any): Promise<string> => {
    setState(prev => ({ ...prev, status: 'creating' }));
    
    try {
      const code = generateCode();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      
      // In production, this would POST to your API
      // For now, we'll simulate the API call
      const response = await fetch('/api/sync/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          data,
          expiresAt: expiresAt.toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create sync session');
      }

      setState({
        status: 'awaiting',
        code,
        progress: 0,
        expiresAt,
        error: null
      });

      toast.success(`Cloud sync code: ${code}`, {
        description: 'Share this code with the receiving device. Valid for 30 minutes.'
      });

      return code;
    } catch (error) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to create session'
      }));
      toast.error('Failed to create cloud sync session');
      throw error;
    }
  }, [generateCode]);

  // Join a sync session (receiver)
  const joinSession = useCallback(async (code: string): Promise<any> => {
    setState(prev => ({ ...prev, status: 'downloading', code }));
    
    try {
      // Simulate download progress
      const progressInterval = setInterval(() => {
        setState(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90)
        }));
      }, 300);

      // In production, this would GET from your API
      const response = await fetch(`/api/sync/join?code=${code}`, {
        method: 'GET'
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Invalid or expired sync code');
        }
        throw new Error('Failed to join sync session');
      }

      const session: SyncSession = await response.json();

      // Check if expired
      if (new Date(session.expiresAt) < new Date()) {
        throw new Error('Sync session has expired');
      }

      setState(prev => ({
        ...prev,
        status: 'complete',
        progress: 100
      }));

      toast.success('Data retrieved from cloud');
      
      return session.data;
    } catch (error) {
      setState(prev => ({
        ...prev,
        status: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Failed to join session'
      }));
      toast.error(error instanceof Error ? error.message : 'Failed to retrieve data');
      throw error;
    }
  }, []);

  // Check if a code exists and is valid
  const checkCode = useCallback(async (code: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/sync/check?code=${code}`, {
        method: 'GET'
      });
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  // Cancel/destroy a session
  const cancelSession = useCallback(async (code?: string) => {
    const sessionCode = code || state.code;
    if (!sessionCode) return;

    try {
      await fetch('/api/sync/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: sessionCode })
      });

      setState({
        status: 'idle',
        code: null,
        progress: 0,
        expiresAt: null,
        error: null
      });
    } catch {
      // Silently fail on cancel
    }
  }, [state.code]);

  // Reset state
  const reset = useCallback(() => {
    setState({
      status: 'idle',
      code: null,
      progress: 0,
      expiresAt: null,
      error: null
    });
  }, []);

  return {
    state,
    createSession,
    joinSession,
    checkCode,
    cancelSession,
    reset
  };
}

export default useCloudSync;
