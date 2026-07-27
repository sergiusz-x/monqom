# WorkspaceApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**workspaceControllerListWorkspaces**](#workspacecontrollerlistworkspaces) | **GET** /workspaces | |

# **workspaceControllerListWorkspaces**
> workspaceControllerListWorkspaces()


### Example

```typescript
import {
    WorkspaceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WorkspaceApi(configuration);

const { status, data } = await apiInstance.workspaceControllerListWorkspaces();
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
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

