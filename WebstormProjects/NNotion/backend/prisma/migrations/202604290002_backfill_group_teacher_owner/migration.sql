-- Backfill group ownership from existing poll targets when the group has
-- historically belonged to exactly one teacher.
UPDATE `study_groups` AS `group`
JOIN (
    SELECT
        `target`.`groupId`,
        MIN(`poll`.`teacherId`) AS `teacherId`
    FROM `poll_target_groups` AS `target`
    JOIN `polls` AS `poll` ON `poll`.`id` = `target`.`pollId`
    GROUP BY `target`.`groupId`
    HAVING COUNT(DISTINCT `poll`.`teacherId`) = 1
) AS `owner` ON `owner`.`groupId` = `group`.`id`
SET `group`.`teacherId` = `owner`.`teacherId`
WHERE `group`.`teacherId` IS NULL;
