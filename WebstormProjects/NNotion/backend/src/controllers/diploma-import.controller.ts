import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app-error";
import { DiplomaImportService } from "../services/diploma-import.service";

export class DiplomaImportController {
    static importDataset = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.file) {
                throw new AppError("Требуется табличный файл", 400);
            }

            const service = new DiplomaImportService();
            const result = await service.importFromWorkbook(req.file.buffer);

            return res.json({ result });
        } catch (error) {
            return next(error);
        }
    };
}
