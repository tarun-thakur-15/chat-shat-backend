// callStore.js
// In-memory store for active calls
export const activeCalls = new Map(); 
// Key: userId
// Value: { callerId, calleeId, status, callId }
