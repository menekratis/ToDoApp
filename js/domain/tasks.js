import { differenceInDays } from "./dates.js";

export function getTaskDueStatus(task, today) {
  if (!task?.dueDate) return { key: "none", daysUntilDue: null };
  if (task.completed) return { key: "complete", daysUntilDue: differenceInDays(today, task.dueDate) };

  const daysUntilDue = differenceInDays(today, task.dueDate);
  if (daysUntilDue < 0) return { key: "overdue", daysUntilDue };
  if (daysUntilDue === 0) return { key: "today", daysUntilDue };
  if (daysUntilDue <= 7) return { key: "soon", daysUntilDue };
  return { key: "scheduled", daysUntilDue };
}

export function compareTasksByPriority(first, second, today) {
  if (first.completed !== second.completed) return first.completed ? 1 : -1;

  const rankDifference = taskPriorityRank(first, today) - taskPriorityRank(second, today);
  if (rankDifference) return rankDifference;
  if (first.dueDate && second.dueDate) return first.dueDate.localeCompare(second.dueDate);
  if (first.dueDate) return -1;
  if (second.dueDate) return 1;
  return (second.updatedAt || "").localeCompare(first.updatedAt || "");
}

export function sortTasksByPriority(tasks, today) {
  return [...tasks].sort((first, second) => compareTasksByPriority(first, second, today));
}

function taskPriorityRank(task, today) {
  const dueStatus = getTaskDueStatus(task, today).key;
  if (dueStatus === "overdue") return 0;
  if (dueStatus === "today") return 1;
  if (task.important) return 2;
  if (dueStatus === "soon") return 3;
  if (task.dueDate) return 4;
  return 5;
}
