import { Router } from "express";
import { NotificationController } from "../controllers/notification.controller";
import { authRequired, roleRequired } from "../midllewares/user.middleware";
import { users_role } from "../../generated/prisma/enums";

export const notificationRouter = Router();

// мои уведомления и настройки
notificationRouter.get(
    "/notifications/me",
    authRequired,
    NotificationController.listMine
);

notificationRouter.get(
    "/notification-settings/me",
    authRequired,
    NotificationController.getMySettings
);

notificationRouter.patch(
    "/notification-settings/me",
    authRequired,
    NotificationController.updateMySettings
);

// просмотр конкретного уведомления доступен владельцу, teacher, admin
notificationRouter.get(
    "/notifications/:id",
    authRequired,
    NotificationController.getById
);

notificationRouter.patch(
    "/notifications/:id/status",
    authRequired,
    NotificationController.updateStatus
);

notificationRouter.patch(
    "/notifications/:id/read",
    authRequired,
    NotificationController.markRead
);

notificationRouter.delete(
    "/notifications/:id",
    authRequired,
    NotificationController.remove
);

// служебные/admin роуты
notificationRouter.post(
    "/notifications",
    authRequired,
    roleRequired(users_role.admin),
    NotificationController.create
);

notificationRouter.get(
    "/notifications",
    authRequired,
    roleRequired(users_role.admin),
    NotificationController.list
);
