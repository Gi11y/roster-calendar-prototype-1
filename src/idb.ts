const DB_NAME = 'roster-calendar-prototype-1';
const STORE = 'settings';
function openDb(): Promise<IDBDatabase> {
 return new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
 });
}
export async function readCalendarId(): Promise<string | undefined> {
 const db = await openDb();
 try {
  return await new Promise((resolve, reject) => {
   const request = db.transaction(STORE, 'readonly').objectStore(STORE).get('calendarId');
   request.onsuccess = () => resolve(request.result as string | undefined);
   request.onerror = () => reject(request.error);
  });
 } finally { db.close(); }
}
export async function saveCalendarId(id: string): Promise<void> {
 const db = await openDb();
 try {
  await new Promise<void>((resolve, reject) => {
   const tx = db.transaction(STORE, 'readwrite');
   tx.objectStore(STORE).put(id, 'calendarId');
   tx.oncomplete = () => resolve();
   tx.onerror = () => reject(tx.error);
   tx.onabort = () => reject(tx.error);
  });
 } finally { db.close(); }
}

export interface PendingCalendarCreation {setupId:string;calendarId?:string}
export async function readPendingCalendarCreation():Promise<PendingCalendarCreation|undefined>{
 const db=await openDb();try{return await new Promise((resolve,reject)=>{const request=db.transaction(STORE,'readonly').objectStore(STORE).get('calendarCreationPending');request.onsuccess=()=>resolve(request.result as PendingCalendarCreation|undefined);request.onerror=()=>reject(request.error);});}finally{db.close();}
}
export async function savePendingCalendarCreation(value:PendingCalendarCreation|undefined):Promise<void>{
 const db=await openDb();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);if(value)store.put(value,'calendarCreationPending');else store.delete('calendarCreationPending');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
}
