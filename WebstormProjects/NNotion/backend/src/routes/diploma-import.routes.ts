import { Router } from "express";
import multer from "multer";
import { DiplomaImportController } from "../controllers/diploma-import.controller";
import { authRequired, roleRequired } from "../midllewares/user.middleware";
import { users_role } from "../../generated/prisma/enums";
import { AppError } from "../errors/app-error";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (_req, file, cb) => {
        const allowedMimeTypes = new Set([
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
            "text/csv",
        ]);

        const allowedExtensions = /\.(xlsx|xls|csv)$/i.test(file.originalname);

        if (allowedMimeTypes.has(file.mimetype) || allowedExtensions) {
            cb(null, true);
            return;
        }

        cb(new AppError("Разрешены только табличные файлы", 400));
    },
});

export const diplomaImportRouter = Router();

diplomaImportRouter.post(
    "/admin/import-diploma",
    authRequired,
    roleRequired(users_role.admin),
    upload.single("file"),
    DiplomaImportController.importDataset
);
