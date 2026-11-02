import { Router } from "express";
import { PollController } from "../controllers/poll.controller";
import { authRequired, roleRequired } from "../midllewares/user.middleware";
import { users_role } from "../../generated/prisma/enums";

export const pollRouter = Router();

pollRouter.post(
    "/polls",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    PollController.create
);

pollRouter.get(
    "/polls",
    authRequired,
    roleRequired(users_role.student, users_role.teacher, users_role.admin),
    PollController.list
);

pollRouter.get(
    "/polls/:pollId/recommendations",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    PollController.getRecommendations
);

pollRouter.get(
    "/polls/:id",
    authRequired,
    roleRequired(users_role.student, users_role.teacher, users_role.admin),
    PollController.getById
);

pollRouter.patch(
    "/polls/:id",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    PollController.update
);

pollRouter.delete(
    "/polls/:id",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    PollController.remove
);

pollRouter.patch(
    "/polls/:id/activate",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    PollController.activate
);

pollRouter.patch(
    "/polls/:id/close",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    PollController.close
);

pollRouter.post(
    "/polls/:id/approve-result",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    PollController.approveResult
);
