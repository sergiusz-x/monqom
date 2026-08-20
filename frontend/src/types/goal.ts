export type GoalStatus = "active" | "completed" | "overdue";
export type GoalOperationType = "deposit" | "withdrawal";

export interface GoalOperation {
  id: string;
  goalId: string;
  type: GoalOperationType;
  amount: number;
  date: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  workspaceId: string;
  name: string;
  targetAmount: number;
  initialAmount: number;
  currency: string;
  targetDate: string;
  planStartMonth: string;
  archivedAt: string | null;
  currentAmount: number;
  remainingAmount: number;
  progressPercentage: number;
  remainingMonths: number;
  recommendedMonthlyAmount: number | null;
  status: GoalStatus;
  operations?: GoalOperation[];
  createdAt: string;
  updatedAt: string;
}
