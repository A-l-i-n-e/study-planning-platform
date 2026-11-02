import { Router } from "express";
import { MlController } from "../controllers/ml.controller";
import { authRequired, roleRequired } from "../midllewares/user.middleware";
import { users_role } from "../../generated/prisma/enums";

export const mlRouter = Router();

mlRouter.get(
    "/ml/slot-training-data",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    MlController.getSlotTrainingData
);
