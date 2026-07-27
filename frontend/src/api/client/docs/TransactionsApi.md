# TransactionsApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**transactionsControllerCreateTransaction**](#transactionscontrollercreatetransaction) | **POST** /workspaces/{workspaceId}/transactions | |
|[**transactionsControllerDeleteTransaction**](#transactionscontrollerdeletetransaction) | **DELETE** /workspaces/{workspaceId}/transactions/{id} | |
|[**transactionsControllerGetTransaction**](#transactionscontrollergettransaction) | **GET** /workspaces/{workspaceId}/transactions/{id} | |
|[**transactionsControllerListTransactions**](#transactionscontrollerlisttransactions) | **GET** /workspaces/{workspaceId}/transactions | |
|[**transactionsControllerUpdateTransaction**](#transactionscontrollerupdatetransaction) | **PUT** /workspaces/{workspaceId}/transactions/{id} | |

# **transactionsControllerCreateTransaction**
> transactionsControllerCreateTransaction(body)


### Example

```typescript
import {
    TransactionsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TransactionsApi(configuration);

let body: object; //

const { status, data } = await apiInstance.transactionsControllerCreateTransaction(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **object**|  | |


### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **transactionsControllerDeleteTransaction**
> transactionsControllerDeleteTransaction()


### Example

```typescript
import {
    TransactionsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TransactionsApi(configuration);

let id: string; // (default to undefined)

const { status, data } = await apiInstance.transactionsControllerDeleteTransaction(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] |  | defaults to undefined|


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
|**204** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **transactionsControllerGetTransaction**
> transactionsControllerGetTransaction()


### Example

```typescript
import {
    TransactionsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TransactionsApi(configuration);

let id: string; // (default to undefined)

const { status, data } = await apiInstance.transactionsControllerGetTransaction(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] |  | defaults to undefined|


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

# **transactionsControllerListTransactions**
> transactionsControllerListTransactions()


### Example

```typescript
import {
    TransactionsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TransactionsApi(configuration);

const { status, data } = await apiInstance.transactionsControllerListTransactions();
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

# **transactionsControllerUpdateTransaction**
> transactionsControllerUpdateTransaction(body)


### Example

```typescript
import {
    TransactionsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TransactionsApi(configuration);

let id: string; // (default to undefined)
let body: object; //

const { status, data } = await apiInstance.transactionsControllerUpdateTransaction(
    id,
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **object**|  | |
| **id** | [**string**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

