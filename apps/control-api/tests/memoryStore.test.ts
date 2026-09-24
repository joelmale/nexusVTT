import { MemoryControlStore } from './support/memoryStore.js';
import { defineStoreContract } from './support/storeContract.js';

let store = new MemoryControlStore();

defineStoreContract('in-memory (test double)', {
  store: () => store,
  reset: async () => {
    store = new MemoryControlStore();
  },
  createUser: async (email, options = {}) => store.addUser({ email, provider: options.provider, isActive: options.isActive }).id,
  addRole: async (userId, role) => store.addRole(userId, role),
});
