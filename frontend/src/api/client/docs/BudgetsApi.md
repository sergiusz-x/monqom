# BudgetsApi

All URIs are relative to *http://localhost*

| Method                                                                          | HTTP request                                       | Description |
| ------------------------------------------------------------------------------- | -------------------------------------------------- | ----------- |
| [**budgetsControllerCreateBudget**](#budgetscontrollercreatebudget)             | **POST** /workspaces/{workspaceId}/budgets         |             |
| [**budgetsControllerDeleteBudget**](#budgetscontrollerdeletebudget)             | **DELETE** /workspaces/{workspaceId}/budgets/{id}  |             |
| [**budgetsControllerListBudgetProgress**](#budgetscontrollerlistbudgetprogress) | **GET** /workspaces/{workspaceId}/budgets/progress |             |
| [**budgetsControllerListBudgets**](#budgetscontrollerlistbudgets)               | **GET** /workspaces/{workspaceId}/budgets          |             |
| [**budgetsControllerUpdateBudget**](#budgetscontrollerupdatebudget)             | **PUT** /workspaces/{workspaceId}/budgets/{id}     |             |

# **budgetsControllerCreateBudget**

> budgetsControllerCreateBudget(body)

### Example

```typescript
import { BudgetsApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new BudgetsApi(configuration);

let body: object; //

const { status, data } = await apiInstance.budgetsControllerCreateBudget(body);
```

### Parameters

| Name     | Type       | Description | Notes |
| -------- | ---------- | ----------- | ----- |
| **body** | **object** |             |       |

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **201**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **budgetsControllerDeleteBudget**

> budgetsControllerDeleteBudget()

### Example

```typescript
import { BudgetsApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new BudgetsApi(configuration);

let id: string; // (default to undefined)

const { status, data } = await apiInstance.budgetsControllerDeleteBudget(id);
```

### Parameters

| Name   | Type         | Description | Notes                 |
| ------ | ------------ | ----------- | --------------------- |
| **id** | [**string**] |             | defaults to undefined |

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **204**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **budgetsControllerListBudgetProgress**

> budgetsControllerListBudgetProgress()

### Example

```typescript
import { BudgetsApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new BudgetsApi(configuration);

const { status, data } =
  await apiInstance.budgetsControllerListBudgetProgress();
```

### Parameters

This endpoint does not have any parameters.

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **budgetsControllerListBudgets**

> budgetsControllerListBudgets()

### Example

```typescript
import { BudgetsApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new BudgetsApi(configuration);

const { status, data } = await apiInstance.budgetsControllerListBudgets();
```

### Parameters

This endpoint does not have any parameters.

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **budgetsControllerUpdateBudget**

> budgetsControllerUpdateBudget(body)

### Example

```typescript
import { BudgetsApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new BudgetsApi(configuration);

let id: string; // (default to undefined)
let body: object; //

const { status, data } = await apiInstance.budgetsControllerUpdateBudget(
  id,
  body,
);
```

### Parameters

| Name     | Type         | Description | Notes                 |
| -------- | ------------ | ----------- | --------------------- |
| **body** | **object**   |             |                       |
| **id**   | [**string**] |             | defaults to undefined |

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
