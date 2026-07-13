"use client";

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Network Detection Hook
 * Automatically detects network conditions and suggests optimal sync method
 */

export type NetworkCondition = 'offline' | 'local' | 'remote' | 'unknown';
export type SyncMethodSuggestion = 'p2p' | 'cloud' | 'hybrid';

interface NetworkStatus {
  condition: NetworkCondition;
  isOnline: boolean;
  localIp: string;
  subnet: string;
  canUseP2P: boolean;
  suggestedMethod: SyncMethodSuggestion;
  confidence: number; // 0-100
}

export function useNetworkDetection() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    condition: 'unknown',
    isOnline: navigator.onLine,
    localIp: '',
    subnet: '',
    canUseP2P: false,
    suggestedMethod: 'hybrid',
    confidence: 0
  });

  const [isDetecting, setIsDetecting] = useState(false);

  // Extract subnet from IP address
  const getSubnet = (ip: string): string => {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}`;
    }
    return '';
  };

  // Detect local IP using WebRTC
  const detectLocalIp = useCallback(async (): Promise<string> => {
    return new Promise((resolve) => {
      try {
        const pc = new RTCPeerConnection({ 
          iceServers: [],
          iceCandidatePoolSize: 2
        });
        
        pc.createDataChannel('');
        
        pc.onicecandidate = (e) => {
          if (!e.candidate) return;
          const ipMatch = e.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
          if (ipMatch) {
            const ip = ipMatch[0];
            // Filter out private IP ranges
            if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
              resolve(ip);
              pc.close();
            }
          }
        };

        // Timeout fallback
        setTimeout(() => {
          resolve('192.168.1.1'); // Default fallback
          pc.close();
        }, 3000);
        
        pc.createOffer().then(o => pc.setLocalDescription(o));
      } catch {
        resolve('192.168.1.1');
      }
    });
  }, []);

  // Check if we can reach the local sync endpoint
  const checkLocalConnectivity = async (): Promise<boolean> => {
    // API routes are removed/unused in offline-first mode
    return false;
  };

  // Check internet connectivity
  const checkInternetConnectivity = async (): Promise<boolean> => {
    try {
      const response = await fetch('https://httpbin.org/get', {
        method: 'HEAD',
        cache: 'no-store',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      try {
        // Fallback to Google DNS
        const response = await fetch('https://8.8.8.8', {
          method: 'HEAD',
          cache: 'no-store',
          signal: AbortSignal.timeout(3000)
        });
        return response.ok;
      } catch {
        return false;
      }
    }
  };

  // Analyze network conditions and suggest sync method
  const analyzeNetwork = useCallback(async () => {
    setIsDetecting(true);
    
    try {
      // Check basic online status
      const isOnline = navigator.onLine;
      if (!isOnline) {
        setNetworkStatus({
          condition: 'offline',
          isOnline: false,
          localIp: '',
          subnet: '',
          canUseP2P: false,
          suggestedMethod: 'cloud',
          confidence: 100
        });
        return;
      }

      // Detect local IP
      const localIp = await detectLocalIp();
      const subnet = getSubnet(localIp);

      // Check connectivity in parallel
      const [hasLocalConnectivity, hasInternetConnectivity] = await Promise.all([
        checkLocalConnectivity(),
        checkInternetConnectivity()
      ]);

      let condition: NetworkCondition;
      let suggestedMethod: SyncMethodSuggestion;
      let canUseP2P: boolean;
      let confidence: number;

      if (hasLocalConnectivity && hasInternetConnectivity) {
        // Both local and internet available - ideal for hybrid
        condition = 'local';
        suggestedMethod = 'hybrid';
        canUseP2P = true;
        confidence = 95;
      } else if (hasLocalConnectivity && !hasInternetConnectivity) {
        // Local network only - P2P required
        condition = 'local';
        suggestedMethod = 'p2p';
        canUseP2P = true;
        confidence = 90;
      } else if (!hasLocalConnectivity && hasInternetConnectivity) {
        // Internet only - cloud required
        condition = 'remote';
        suggestedMethod = 'cloud';
        canUseP2P = false;
        confidence = 85;
      } else {
        // No connectivity
        condition = 'offline';
        suggestedMethod = 'cloud';
        canUseP2P = false;
        confidence = 100;
      }

      setNetworkStatus({
        condition,
        isOnline,
        localIp,
        subnet,
        canUseP2P,
        suggestedMethod,
        confidence
      });

    } catch (error) {
      console.error('Network detection failed:', error);
      setNetworkStatus({
        condition: 'unknown',
        isOnline: navigator.onLine,
        localIp: '',
        subnet: '',
        canUseP2P: false,
        suggestedMethod: 'hybrid',
        confidence: 0
      });
    } finally {
      setIsDetecting(false);
    }
  }, [detectLocalIp]);

  // Auto-detect on mount and when online status changes
  useEffect(() => {
    analyzeNetwork();

    const handleOnline = () => {
      toast.info('Network connection restored');
      analyzeNetwork();
    };

    const handleOffline = () => {
      toast.warning('Network connection lost');
      setNetworkStatus(prev => ({
        ...prev,
        isOnline: false,
        condition: 'offline',
        canUseP2P: false,
        suggestedMethod: 'cloud',
        confidence: 100
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic re-check every 2 minutes
    const interval = setInterval(analyzeNetwork, 120000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [analyzeNetwork]);

  // Manual re-detection
  const redetect = useCallback(() => {
    analyzeNetwork();
  }, [analyzeNetwork]);

  // Get recommendation message
  const getRecommendation = useCallback((): string => {
    if (!networkStatus.isOnline) {
      return 'No internet connection. Please check your network.';
    }

    switch (networkStatus.suggestedMethod) {
      case 'p2p':
        return 'Local network detected. P2P sync is recommended for fastest transfer.';
      case 'cloud':
        return 'Only internet connection available. Cloud sync is required.';
      case 'hybrid':
        return 'Both local and internet available. Hybrid mode will try P2P first, then cloud fallback.';
      default:
        return 'Network detection in progress...';
    }
  }, [networkStatus]);

  return {
    networkStatus,
    isDetecting,
    redetect,
    getRecommendation
  };
}

export default useNetworkDetection;
