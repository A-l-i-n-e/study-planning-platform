import { Router } from "express";
import { VoteController } from "../controllers/vote.controller";
import { authRequired, roleRequired } from "../midllewares/user.middleware";
import { users_role } from "../../generated/prisma/enums";

export const voteRouter = Router();

// голосование студентов
voteRouter.post(
    "/votes",
    authRequired,
    roleRequired(users_role.student),
    VoteController.create
);

voteRouter.get(
    "/votes/polls/:pollId/my",
    authRequired,
    roleRequired(users_role.student),
    VoteController.getMyVote
);

voteRouter.delete(
    "/votes/polls/:pollId/my",
    authRequired,
    roleRequired(users_role.student),
    VoteController.deleteMyVote
);

// просмотр голосов и результатов преподавателем/админом
voteRouter.get(
    "/votes/polls/:pollId",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    VoteController.listPollVotes
);

voteRouter.get(
    "/votes/polls/:pollId/results",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    VoteController.getPollResults
);