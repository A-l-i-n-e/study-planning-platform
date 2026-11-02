import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { prisma } from "./config/prisma";
import { userRouter } from "./routes/user.routes";
import { studyGroupRouter } from "./routes/study-group.routes";
import { pollRouter } from "./routes/poll.routes";
import { voteRouter } from "./routes/vote.routes";
import { eventRouter } from "./routes/event.routes";
import { notificationRouter } from "./routes/notification.routes";
import { personalTaskRouter } from "./routes/personal-task.routes";
import { diplomaImportRouter } from "./routes/diploma-import.routes";
import { mlRouter } from "./routes/ml.routes";
import { PollService } from "./services/poll.service";
import { errorMiddleware } from "./midllewares/error.middleware";
import { notFoundMiddleware } from "./midllewares/not-found.middleware";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const pollDeadlineService = new PollService();
const pollDeadlineIntervalMs = 60 * 1000;

const closeExpiredPolls = async () => {
    try {
        await pollDeadlineService.closeExpiredPolls();
    } catch (error) {
        console.error("Poll deadline sync error:", error);
    }
};

app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", userRouter);
app.use("/api", studyGroupRouter);
app.use("/api", pollRouter);
app.use("/api", voteRouter);
app.use("/api", eventRouter);
app.use("/api", notificationRouter);
app.use("/api", personalTaskRouter);
app.use("/api", diplomaImportRouter);
app.use("/api", mlRouter);

app.get("/health", async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({
            status: "OK",
            database: "connected",
        });
    } catch (_error) {
        res.status(500).json({
            status: "ERROR",
            database: "disconnected",
        });
    }
});

app.use(notFoundMiddleware);
app.use(errorMiddleware);

async function startServer() {
    try {
        await prisma.$connect();
        console.log("Database connected");
        await closeExpiredPolls();
        setInterval(() => {
            void closeExpiredPolls();
        }, pollDeadlineIntervalMs);

        app.listen(PORT, () => {
            console.log(`Server started on port ${PORT}`);
        });
    } catch (error) {
        console.error("Server start error:", error);
        process.exit(1);
    }
}

startServer();
