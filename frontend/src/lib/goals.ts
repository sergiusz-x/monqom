import type { ApiGoal, ApiGoalOperation } from "@/types/api-contracts";
import type { Goal, GoalOperation } from "@/types/goal";
import { getDateOnlyInTimeZone, parseDateOnlyParts } from "@/lib/date-only";

export function mapGoal(value: ApiGoal): Goal {
  return {
    id: value.id,
    workspaceId: value.workspace_id,
    name: value.name,
    targetAmount: value.target_amount,
    initialAmount: value.initial_amount,
    currency: value.currency,
    targetDate: value.target_date,
    planStartMonth: value.plan_start_month,
    archivedAt: value.archived_at,
    currentAmount: value.current_amount,
    remainingAmount: value.remaining_amount,
    progressPercentage: value.progress_percentage,
    remainingMonths: value.remaining_months,
    recommendedMonthlyAmount: value.recommended_monthly_amount,
    status: value.status,
    operations: value.operations?.map(mapGoalOperation),
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

function mapGoalOperation(value: ApiGoalOperation): GoalOperation {
  return {
    id: value.id,
    goalId: value.goal_id,
    type: value.type,
    amount: value.amount,
    date: value.date,
    note: value.note,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

export function todayInTimeZone(timeZone: string, now = new Date()): string {
  return getDateOnlyInTimeZone(now, timeZone);
}

export function addMonthsClamped(date: string, months: number): string {
  const [year, month, day] = requireDateOnlyParts(date);
  const targetFirst = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return dateParts(
    targetFirst.getUTCFullYear(),
    targetFirst.getUTCMonth() + 1,
    Math.min(day, lastDay),
  );
}

export function monthsUntilDate(today: string, target: string): number {
  const [ty, tm] = requireDateOnlyParts(today);
  const [yy, ym] = requireDateOnlyParts(target);
  let months = (yy - ty) * 12 + ym - tm;
  if (addMonthsClamped(today, months) < target) months += 1;
  return Math.min(120, Math.max(1, months));
}

export function previewMonthlyAmount(input: {
  targetAmountCents: number;
  initialAmountCents: number;
  today: string;
  targetDate: string;
  includeCurrentMonth: boolean;
}): { months: number; monthlyAmountCents: number } {
  const [todayYear, todayMonth] = requireDateOnlyParts(input.today);
  const [targetYear, targetMonth] = requireDateOnlyParts(input.targetDate);
  const startOffset = input.includeCurrentMonth ? 0 : 1;
  const months = Math.max(
    0,
    (targetYear - todayYear) * 12 + targetMonth - todayMonth - startOffset + 1,
  );
  const remaining = Math.max(
    input.targetAmountCents - input.initialAmountCents,
    0,
  );
  return {
    months,
    monthlyAmountCents: months > 0 ? Math.ceil(remaining / months) : remaining,
  };
}

function dateParts(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function requireDateOnlyParts(value: string): [number, number, number] {
  const parts = parseDateOnlyParts(value);
  if (!parts) throw new RangeError("Expected a valid YYYY-MM-DD date");
  return parts;
}
