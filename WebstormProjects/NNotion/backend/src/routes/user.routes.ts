import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { authRequired, roleRequired } from "../midllewares/user.middleware";
import { users_role } from "../../generated/prisma/enums";

export const userRouter = Router();

userRouter.post("/auth/register", UserController.register);
userRouter.post("/auth/login", UserController.login);
userRouter.post("/auth/role-login", UserController.roleLogin);
userRouter.get("/auth/login-options", UserController.loginOptions);
userRouter.post("/auth/user-login", UserController.userLogin);

userRouter.get("/users/me", authRequired, UserController.me);
userRouter.post("/users/change-password", authRequired, UserController.changePassword);

userRouter.get("/users", authRequired, roleRequired(users_role.teacher, users_role.admin), UserController.list);
userRouter.get("/users/:id", authRequired, roleRequired(users_role.teacher, users_role.admin), UserController.getById);

userRouter.post("/users", authRequired, roleRequired(users_role.admin), UserController.createByAdmin);
userRouter.patch("/users/:id", authRequired, roleRequired(users_role.admin), UserController.update);
userRouter.delete("/users/:id", authRequired, roleRequired(users_role.admin), UserController.remove);

userRouter.get("/admin/stats", authRequired, roleRequired(users_role.admin), UserController.adminStats);
