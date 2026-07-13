"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

/**
 * P2P Sync Manager
 * Handles WebRTC peer-to-peer connections for local network sync
 */

export type P2PStatus = 'idle' | 'connecting' | 'connected' | 'transferring' | 'disconnected' | 'error';

interface P2PMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'data-chunk' | 'sync-complete' | 'error';
  payload: any;
  timestamp: number;
}

interface P2PSyncState {
  status: P2PStatus;
  localIp: string;
  remoteIp: string | null;
  progress: number;
  error: string | null;
}

export function useP2PSync(onDataReceived?: (data: any) => void) {
  const [state, setState] = useState<P2PSyncState>({
    status: 'idle',
    localIp: '',
    remoteIp: null,
    progress: 0,
    error: null
  });

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const chunksRef = useRef<string[]>([]);
  const totalChunksRef = useRef<number>(0);

  // Detect local IP address
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
            resolve(ipMatch[0]);
            pc.close();
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

  // Initialize P2P as sender
  const initSender = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, status: 'connecting' }));
      
      const localIp = await detectLocalIp();
      setState(prev => ({ ...prev, localIp }));

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      pcRef.current = pc;

      // Create data channel
      const dc = pc.createDataChannel('sync', {
        ordered: true,
        maxRetransmits: 3
      });
      dcRef.current = dc;

      dc.onopen = () => {
        setState(prev => ({ ...prev, status: 'connected' }));
        toast.success('P2P connection established');
      };

      dc.onclose = () => {
        setState(prev => ({ ...prev, status: 'disconnected' }));
      };

      dc.onerror = (e) => {
        setState(prev => ({ ...prev, status: 'error', error: 'Data channel error' }));
        toast.error('P2P connection error');
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') resolve();
          };
          // Timeout after 5 seconds
          setTimeout(resolve, 5000);
        }
      });

      // Return the offer for QR code/manual sharing
      return JSON.stringify(pc.localDescription);

    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Failed to initialize P2P' 
      }));
      toast.error('Failed to initialize P2P connection');
      throw error;
    }
  }, [detectLocalIp]);

  // Handle incoming messages
  const handleIncomingMessage = useCallback((data: string) => {
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'data-chunk') {
        const { chunk, index, total, progress } = message.payload;
        
        // Initialize chunks array if first chunk
        if (chunksRef.current.length === 0 || totalChunksRef.current !== total) {
          chunksRef.current = new Array(total).fill('');
          totalChunksRef.current = total;
        }

        // Store chunk
        if (chunksRef.current.length > index) {
          chunksRef.current[index] = chunk;
        }

        setState(prev => ({ 
          ...prev, 
          progress: progress,
          status: 'transferring'
        }));

        // Check if transfer complete
        const receivedCount = chunksRef.current.filter(c => c !== '').length;
        if (receivedCount === total) {
          // Reassemble data
          const fullDataString = chunksRef.current.join('');
          try {
            const finalData = JSON.parse(fullDataString);
            
            // Reset chunks
            chunksRef.current = [];
            totalChunksRef.current = 0;
            
            setState(prev => ({ ...prev, status: 'connected', progress: 100 }));
            toast.success('Sync data received successfully');
            
            // Notify callback
            if (onDataReceived) {
              onDataReceived(finalData);
            }
          } catch (e) {
            console.error('Failed to parse reassembled data', e);
            toast.error('Failed to process received data');
          }
        }
      } else if (message.type === 'sync-complete') {
        // Legacy support or specific signal
        setState(prev => ({ ...prev, status: 'idle', progress: 100 }));
      }
    } catch (e) {
      console.error('Error handling incoming P2P message', e);
    }
  }, [onDataReceived]);

  // Initialize P2P as receiver
  const initReceiver = useCallback(async (offerStr: string) => {
    try {
      setState(prev => ({ ...prev, status: 'connecting' }));
      
      const offer = JSON.parse(offerStr);

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      pcRef.current = pc;

      // Handle incoming data channel
      pc.ondatachannel = (e) => {
        const dc = e.channel;
        dcRef.current = dc;

        dc.onopen = () => {
          setState(prev => ({ ...prev, status: 'connected' }));
          toast.success('P2P connection established');
        };

        dc.onmessage = (event) => {
          handleIncomingMessage(event.data);
        };

        dc.onclose = () => {
          setState(prev => ({ ...prev, status: 'disconnected' }));
        };
      };

      // Set remote description
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Wait for ICE gathering
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') resolve();
          };
          setTimeout(resolve, 5000);
        }
      });

      return JSON.stringify(pc.localDescription);

    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Failed to connect' 
      }));
      toast.error('Failed to establish P2P connection');
      throw error;
    }
  }, [handleIncomingMessage]);

  // Complete connection with answer (for sender)
  const completeConnection = useCallback(async (answerStr: string) => {
    try {
      const pc = pcRef.current;
      if (!pc) throw new Error('Peer connection not initialized');

      const answer = JSON.parse(answerStr);
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Failed to complete connection' 
      }));
      throw error;
    }
  }, []);

  // Send data via P2P
  const sendData = useCallback(async (data: any) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    setState(prev => ({ ...prev, status: 'transferring', progress: 0 }));

    try {
      // Chunk large data
      const chunkSize = 16000; // Safe chunk size
      const dataString = JSON.stringify(data);
      const totalChunks = Math.ceil(dataString.length / chunkSize);

      for (let i = 0; i < totalChunks; i++) {
        const chunk = dataString.slice(i * chunkSize, (i + 1) * chunkSize);
        const message = {
          type: 'data-chunk',
          payload: {
            chunk,
            index: i,
            total: totalChunks,
            progress: Math.round(((i + 1) / totalChunks) * 100)
          },
          timestamp: Date.now()
        };

        dc.send(JSON.stringify(message));
        
        const progress = Math.round(((i + 1) / totalChunks) * 100);
        setState(prev => ({ ...prev, progress }));

        // Backpressure control: wait if buffer is full
        if (dc.bufferedAmount > 160000) { // 160KB
           await new Promise(r => setTimeout(r, 50));
        }
      }

      setState(prev => ({ ...prev, status: 'connected', progress: 100 }));
      toast.success('Data sent successfully');

    } catch (error) {
      console.error('Send error:', error);
      setState(prev => ({ ...prev, status: 'error', error: 'Failed to send data' }));
      toast.error('Failed to send data');
      throw error;
    }
  }, []);

  // Disconnect and cleanup
  const disconnect = useCallback(() => {
    dcRef.current?.close();
    pcRef.current?.close();
    
    dcRef.current = null;
    pcRef.current = null;
    chunksRef.current = [];
    totalChunksRef.current = 0;
    
    setState({
      status: 'idle',
      localIp: '',
      remoteIp: null,
      progress: 0,
      error: null
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    state,
    initSender,
    initReceiver,
    completeConnection,
    sendData,
    disconnect,
    detectLocalIp
  };
}

export default useP2PSync;
