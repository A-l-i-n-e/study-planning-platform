import { Router } from "express";
import { authRequired } from "../midllewares/user.middleware";
import { PersonalTaskController } from "../controllers/personal-task.controller";

export const personalTaskRouter = Router();

personalTaskRouter.get("/personal-tasks", authRequired, PersonalTaskController.listMine);
personalTaskRouter.post("/personal-tasks", authRequired, PersonalTaskController.create);
personalTaskRouter.patch("/personal-tasks/:id", authRequired, PersonalTaskController.update);
personalTaskRouter.delete("/personal-tasks/:id", authRequired, PersonalTaskController.remove);
