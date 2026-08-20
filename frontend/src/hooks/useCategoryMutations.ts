import { useMutation, useQueryClient } from "@tanstack/react-query";
import { categoriesApi } from "@/api/contract";
import { queryKeys } from "@/lib/query-client";
import type { Category } from "@/types/category";
import type { CategoryBodyDto } from "@/api/client";

export interface CategoryInput {
  name: string;
  icon: string | null;
  parent_id: string | null;
  type?: "expense" | "income";
}

type CategoriesSnapshot = Array<[readonly unknown[], Category[] | undefined]>;

function updateCategoryTree(
  categories: Category[],
  id: string,
  isArchived: boolean,
): Category[] {
  return categories.map((category) =>
    category.id === id
      ? archiveTree(category, isArchived)
      : {
          ...category,
          children: updateCategoryTree(category.children, id, isArchived),
        },
  );
}

function archiveTree(category: Category, isArchived: boolean): Category {
  return {
    ...category,
    isArchived,
    archivedAt: isArchived ? new Date().toISOString() : null,
    children: category.children.map((child) => archiveTree(child, isArchived)),
  };
}

export function useCategoryMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.categories(workspaceId);
  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const updateArchiveState = async (
    id: string,
    isArchived: boolean,
  ): Promise<CategoriesSnapshot> => {
    await queryClient.cancelQueries({ queryKey });
    const previous = queryClient.getQueriesData<Category[]>({
      queryKey,
    }) as CategoriesSnapshot;
    queryClient.setQueriesData<Category[]>({ queryKey }, (current) =>
      current ? updateCategoryTree(current, id, isArchived) : current,
    );
    return previous;
  };

  const restoreSnapshot = (previous?: CategoriesSnapshot) => {
    previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
  };

  const create = useMutation({
    mutationFn: (input: CategoryInput) =>
      categoriesApi.categoriesControllerCreateCategory(
        workspaceId,
        input as unknown as CategoryBodyDto,
      ),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CategoryInput }) =>
      categoriesApi.categoriesControllerUpdateCategory(
        id,
        workspaceId,
        input as unknown as CategoryBodyDto,
      ),
    onSuccess: invalidate,
  });
  const hide = useMutation({
    mutationFn: (id: string) =>
      categoriesApi.categoriesControllerArchiveCategory(id, workspaceId),
    onMutate: (id) => updateArchiveState(id, true),
    onError: (_error, _id, previous) => restoreSnapshot(previous),
    onSettled: invalidate,
  });
  const restore = useMutation({
    mutationFn: (id: string) =>
      categoriesApi.categoriesControllerRestoreCategory(id, workspaceId),
    onMutate: (id) => updateArchiveState(id, false),
    onError: (_error, _id, previous) => restoreSnapshot(previous),
    onSettled: invalidate,
  });
  return { create, update, hide, restore };
}
