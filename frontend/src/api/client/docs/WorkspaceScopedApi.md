# WorkspaceScopedApi

All URIs are relative to *http://localhost*

| Method                                                                                    | HTTP request                      | Description |
| ----------------------------------------------------------------------------------------- | --------------------------------- | ----------- |
| [**workspaceScopedControllerGetWorkspace**](#workspacescopedcontrollergetworkspace)       | **GET** /workspaces/{workspaceId} |             |
| [**workspaceScopedControllerUpdateWorkspace**](#workspacescopedcontrollerupdateworkspace) | **PUT** /workspaces/{workspaceId} |             |

# **workspaceScopedControllerGetWorkspace**

> workspaceScopedControllerGetWorkspace()

### Example

```typescript
import { WorkspaceScopedApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new WorkspaceScopedApi(configuration);

const { status, data } =
  await apiInstance.workspaceScopedControllerGetWorkspace();
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

# **workspaceScopedControllerUpdateWorkspace**

> workspaceScopedControllerUpdateWorkspace(body)

### Example

```typescript
import { WorkspaceScopedApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new WorkspaceScopedApi(configuration);

let body: object; //

const { status, data } =
  await apiInstance.workspaceScopedControllerUpdateWorkspace(body);
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
| **200**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
