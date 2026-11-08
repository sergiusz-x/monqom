-- Preserve the historical allocation while enforcing that its goal belongs to the same workspace.
ALTER TABLE "monthly_goal_allocations" ADD CONSTRAINT "monthly_goal_allocations_workspace_goal_fkey" FOREIGN KEY ("workspace_id", "goal_id") REFERENCES "goals"("workspace_id", "id") ON DELETE SET NULL ("goal_id") ON UPDATE CASCADE;
