
import { Message } from "@/components/ai-assistant";
import { DBChangeListener } from "./db";

const DB_NAME = "AfiaChatDB";
const STORE_NAME = "chat_history";
const CHAT_KEY = "current_session"; // We only persist one session for now as per "Research Lab" concept
const DB_VERSION = 1;

const listeners = new Set<DBChangeListener>();

function notify() {
  listeners.forEach(listener => listener());
}

function subscribe(listener: DBChangeListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = () => reject("Failed to open Chat Database");
  });
}

export const chatDB = {
  subscribe,
  
  save: async (messages: any[]) => {
    const db = await getDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(messages, CHAT_KEY);
      request.onsuccess = () => {
        notify();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  },
  
  load: async (): Promise<any[]> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(CHAT_KEY);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },
  
  clear: async () => {
    const db = await getDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(CHAT_KEY);
      request.onsuccess = () => {
        notify();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
};

export const saveChat = chatDB.save;
export const loadChat = chatDB.load;
export const clearChat = chatDB.clear;
