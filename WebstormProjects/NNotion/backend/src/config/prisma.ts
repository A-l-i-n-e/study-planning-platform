import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

declare global {
    var prisma: PrismaClient | undefined;
}

function getDatabaseUrl() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        throw new Error("DATABASE_URL is not configured");
    }

    const url = new URL(databaseUrl);

    if ((url.protocol === "mysql:" || url.protocol === "mariadb:") && !url.searchParams.has("allowPublicKeyRetrieval")) {
        url.searchParams.set("allowPublicKeyRetrieval", "true");
    }

    return url.toString();
}

const adapter = new PrismaMariaDb(getDatabaseUrl());

export const prisma =
    global.prisma ??
    new PrismaClient({
        adapter,
    });

if (process.env.NODE_ENV !== "production") {
    global.prisma = prisma;
}
