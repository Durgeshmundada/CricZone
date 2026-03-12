const express = require("express");
const teamController = require("../controllers/teamController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.get("/suggestions", teamController.getPlayerSuggestions);
router.get("/invitations/my", teamController.getMyInvitations);
router.post("/randomize", teamController.randomizeTeams);
router.get("/", teamController.getAllTeams);
router.post("/", teamController.createTeam);
router.post("/create", teamController.createTeam);
router.put("/:teamId/invitations/:memberId/respond", teamController.respondToInvitation);
router.get("/:teamId", teamController.getTeam);
router.put("/:teamId", teamController.updateTeam);
router.delete("/:teamId", teamController.deleteTeam);

module.exports = router;
