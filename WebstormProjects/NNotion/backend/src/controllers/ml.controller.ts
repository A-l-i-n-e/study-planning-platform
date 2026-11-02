import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app-error";
import { SlotTrainingDataService } from "../services/slot-training-data.service";

export class MlController {
    static getSlotTrainingData = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new SlotTrainingDataService();
            const dataset = await service.getTrainingDataset(currentUser);

            return res.json({
                dataset,
                meta: {
                    samples: dataset.length,
                    features: [
                        "votesShare",
                        "teacherAvailable",
                        "groupAvailable",
                        "convenience",
                        "normalizedDayOfWeek",
                        "normalizedStartHour",
                    ],
                    target: "selectedByTeacher",
                },
            });
        } catch (e) {
            return next(e);
        }
    };
}
