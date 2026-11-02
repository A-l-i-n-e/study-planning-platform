/*
  Warnings:

  - You are about to drop the `courses` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `login` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `session_participants` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `student` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `teacher` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `courses`;

-- DropTable
DROP TABLE `login`;

-- DropTable
DROP TABLE `session`;

-- DropTable
DROP TABLE `session_participants`;

-- DropTable
DROP TABLE `student`;

-- DropTable
DROP TABLE `teacher`;

-- CreateTable
CREATE TABLE `events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pollId` INTEGER NULL,
    `teacherId` INTEGER NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `startAt` TIMESTAMP(0) NOT NULL,
    `endAt` TIMESTAMP(0) NOT NULL,
    `format` ENUM('ONLINE', 'OFFLINE') NOT NULL,
    `location` VARCHAR(255) NULL,
    `link` VARCHAR(500) NULL,
    `status` ENUM('scheduled', 'cancelled', 'completed') NULL DEFAULT 'scheduled',
    `createdAt` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `pollId`(`pollId`),
    INDEX `idx_start`(`startAt`),
    INDEX `idx_status`(`status`),
    INDEX `idx_teacher`(`teacherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `channel` ENUM('EMAIL', 'TELEGRAM', 'IN_APP', 'CALENDAR') NOT NULL,
    `type` VARCHAR(100) NOT NULL,
    `payload` JSON NULL,
    `status` ENUM('PENDING', 'SENT', 'FAILED') NULL DEFAULT 'PENDING',
    `createdAt` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `sentAt` TIMESTAMP(0) NULL,

    INDEX `idx_channel`(`channel`),
    INDEX `idx_created`(`createdAt`),
    INDEX `idx_status`(`status`),
    INDEX `idx_user`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `poll_options` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pollId` INTEGER NOT NULL,
    `startAt` TIMESTAMP(0) NOT NULL,
    `endAt` TIMESTAMP(0) NOT NULL,
    `format` ENUM('ONLINE', 'OFFLINE') NOT NULL,
    `location` VARCHAR(255) NULL,
    `link` VARCHAR(500) NULL,

    INDEX `idx_end`(`endAt`),
    INDEX `idx_poll`(`pollId`),
    INDEX `idx_start`(`startAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `poll_participants_snapshot` (
    `pollId` INTEGER NOT NULL,
    `studentId` INTEGER NOT NULL,

    INDEX `idx_student`(`studentId`),
    PRIMARY KEY (`pollId`, `studentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `poll_target_groups` (
    `pollId` INTEGER NOT NULL,
    `groupId` INTEGER NOT NULL,

    INDEX `idx_group`(`groupId`),
    PRIMARY KEY (`pollId`, `groupId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `polls` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `teacherId` INTEGER NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `deadlineAt` TIMESTAMP(0) NOT NULL,
    `threshold` INTEGER NULL DEFAULT 60,
    `status` ENUM('draft', 'active', 'closed') NULL DEFAULT 'draft',
    `createdAt` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_deadline`(`deadlineAt`),
    INDEX `idx_status`(`status`),
    INDEX `idx_teacher`(`teacherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `study_groups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,

    INDEX `idx_name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_notification_settings` (
    `userId` INTEGER NOT NULL,
    `emailEnabled` BOOLEAN NULL DEFAULT true,
    `telegramEnabled` BOOLEAN NULL DEFAULT false,
    `telegramChatId` VARCHAR(255) NULL,
    `inAppEnabled` BOOLEAN NULL DEFAULT true,
    `calendarEnabled` BOOLEAN NULL DEFAULT false,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `passHash` VARCHAR(255) NOT NULL,
    `role` ENUM('student', 'teacher', 'admin') NOT NULL,
    `createdAt` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `groupId` INTEGER NULL,

    UNIQUE INDEX `email`(`email`),
    INDEX `idx_email`(`email`),
    INDEX `idx_role`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `votes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pollId` INTEGER NOT NULL,
    `optionId` INTEGER NOT NULL,
    `studentId` INTEGER NOT NULL,
    `votedAt` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_option`(`optionId`),
    INDEX `idx_poll`(`pollId`),
    INDEX `idx_student`(`studentId`),
    UNIQUE INDEX `unique_vote`(`pollId`, `optionId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `events_ibfk_1` FOREIGN KEY (`pollId`) REFERENCES `polls`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `events_ibfk_2` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `poll_options` ADD CONSTRAINT `poll_options_ibfk_1` FOREIGN KEY (`pollId`) REFERENCES `polls`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `poll_participants_snapshot` ADD CONSTRAINT `poll_participants_snapshot_ibfk_1` FOREIGN KEY (`pollId`) REFERENCES `polls`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `poll_participants_snapshot` ADD CONSTRAINT `poll_participants_snapshot_ibfk_2` FOREIGN KEY (`studentId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `poll_target_groups` ADD CONSTRAINT `poll_target_groups_ibfk_1` FOREIGN KEY (`pollId`) REFERENCES `polls`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `poll_target_groups` ADD CONSTRAINT `poll_target_groups_ibfk_2` FOREIGN KEY (`groupId`) REFERENCES `study_groups`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `polls` ADD CONSTRAINT `polls_ibfk_1` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user_notification_settings` ADD CONSTRAINT `user_notification_settings_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `study_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `votes` ADD CONSTRAINT `votes_ibfk_1` FOREIGN KEY (`pollId`) REFERENCES `polls`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `votes` ADD CONSTRAINT `votes_ibfk_2` FOREIGN KEY (`optionId`) REFERENCES `poll_options`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `votes` ADD CONSTRAINT `votes_ibfk_3` FOREIGN KEY (`studentId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
