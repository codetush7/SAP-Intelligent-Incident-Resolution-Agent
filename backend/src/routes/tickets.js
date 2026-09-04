const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const {
  listTickets,
  getTicketById,
  createTicket,
  updateTicket,
  applyFix,
  deleteTicket,
  syncJira
} = require('../controllers/ticketController');

router.use(requireAuth);

router.get('/', listTickets);
router.get('/:id', getTicketById);
router.post('/', createTicket);
router.patch('/:id', updateTicket);
router.post('/:id/fix', applyFix);
router.delete('/:id', deleteTicket);
router.post('/:id/sync-jira', syncJira);

module.exports = router;