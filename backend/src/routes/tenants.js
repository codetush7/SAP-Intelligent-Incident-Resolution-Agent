const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const {
  listTenants,
  createTenant,
  retestTenant,
  updateTenant,
  activateTenant,
  removeTenant
} = require('../controllers/tenantController');

router.use(requireAuth);

// GET /api/tenants
router.get('/', listTenants);

// POST /api/tenants
router.post('/', createTenant);

// POST /api/tenants/:id/test
router.post('/:id/test', retestTenant);

// PATCH /api/tenants/:id
router.patch('/:id', updateTenant);

// POST /api/tenants/:id/activate
router.post('/:id/activate', activateTenant);

// DELETE /api/tenants/:id
router.delete('/:id', removeTenant);

module.exports = router;