import { adminFixtures } from '../data/adminFixtures';
import { createMockAdminService, type AdminService } from './adminService';
import { requireAdmin } from '../auth/server';

// Substituir somente esta composição por um adaptador REST quando a API existir.
const mock = createMockAdminService(adminFixtures);
export const adminService: AdminService = {
  async getReport() {
    await requireAdmin();
    return mock.getReport();
  },
};
