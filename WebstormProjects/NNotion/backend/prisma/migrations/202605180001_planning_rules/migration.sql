ALTER TABLE `polls`
  ADD COLUMN `discipline` VARCHAR(191) NULL,
  ADD COLUMN `lessonType` VARCHAR(191) NOT NULL DEFAULT 'другое',
  ADD COLUMN `recommendedOptionId` INTEGER NULL,
  ADD COLUMN `finalOptionId` INTEGER NULL,
  ADD COLUMN `approvedAt` DATETIME(3) NULL;

ALTER TABLE `events`
  ADD COLUMN `groupId` INTEGER NULL,
  ADD COLUMN `discipline` VARCHAR(191) NULL,
  ADD COLUMN `lessonType` VARCHAR(191) NOT NULL DEFAULT 'другое',
  ADD COLUMN `isOfficial` BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX `events_groupId_idx` ON `events`(`groupId`);
CREATE INDEX `events_teacherId_startAt_idx` ON `events`(`teacherId`, `startAt`);

ALTER TABLE `events`
  ADD CONSTRAINT `events_groupId_fkey`
  FOREIGN KEY (`groupId`) REFERENCES `study_groups`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `personal_tasks` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` VARCHAR(2000) NULL,
  `taskDate` DATETIME(3) NOT NULL,
  `taskTime` VARCHAR(16) NULL,
  `completed` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `personal_tasks_userId_taskDate_idx`(`userId`, `taskDate`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `personal_tasks`
  ADD CONSTRAINT `personal_tasks_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `notifications`
  ADD COLUMN `category` VARCHAR(191) NOT NULL DEFAULT 'system',
  ADD COLUMN `readAt` DATETIME(3) NULL,
  ADD COLUMN `scheduledFor` DATETIME(3) NULL;

CREATE INDEX `notifications_userId_category_idx` ON `notifications`(`userId`, `category`);
CREATE INDEX `notifications_scheduledFor_idx` ON `notifications`(`scheduledFor`);
