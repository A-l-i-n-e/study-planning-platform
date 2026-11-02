import { Router } from "express";
import { EventController } from "../controllers/event.controllers";
import { authRequired, roleRequired } from "../midllewares/user.middleware";
import { users_role } from "../../generated/prisma/enums";

export const eventRouter = Router();

eventRouter.post(
    "/events",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    EventController.create
);

eventRouter.post(
    "/events/from-poll",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    EventController.createFromPoll
);

eventRouter.get(
    "/events",
    authRequired,
    roleRequired(users_role.student, users_role.teacher, users_role.admin),
    EventController.list
);

eventRouter.get(
    "/events/:id",
    authRequired,
    roleRequired(users_role.student, users_role.teacher, users_role.admin),
    EventController.getById
);

eventRouter.patch(
    "/events/:id",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    EventController.update
);

eventRouter.delete(
    "/events/:id",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    EventController.remove
);

eventRouter.patch(
    "/events/:id/cancel",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    EventController.cancel
);

eventRouter.patch(
    "/events/:id/complete",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    EventController.complete
);
