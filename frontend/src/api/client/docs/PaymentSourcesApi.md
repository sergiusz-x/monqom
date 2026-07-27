# PaymentSourcesApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**paymentSourcesControllerArchivePaymentSource**](#paymentsourcescontrollerarchivepaymentsource) | **POST** /workspaces/{workspaceId}/payment-sources/{id}/archive | |
|[**paymentSourcesControllerCreatePaymentSource**](#paymentsourcescontrollercreatepaymentsource) | **POST** /workspaces/{workspaceId}/payment-sources | |
|[**paymentSourcesControllerListPaymentSources**](#paymentsourcescontrollerlistpaymentsources) | **GET** /workspaces/{workspaceId}/payment-sources | |
|[**paymentSourcesControllerUpdatePaymentSource**](#paymentsourcescontrollerupdatepaymentsource) | **PUT** /workspaces/{workspaceId}/payment-sources/{id} | |

# **paymentSourcesControllerArchivePaymentSource**
> paymentSourcesControllerArchivePaymentSource()


### Example

```typescript
import {
    PaymentSourcesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PaymentSourcesApi(configuration);

let id: string; // (default to undefined)

const { status, data } = await apiInstance.paymentSourcesControllerArchivePaymentSource(
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

# **paymentSourcesControllerCreatePaymentSource**
> paymentSourcesControllerCreatePaymentSource(body)


### Example

```typescript
import {
    PaymentSourcesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PaymentSourcesApi(configuration);

let body: object; //

const { status, data } = await apiInstance.paymentSourcesControllerCreatePaymentSource(
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

# **paymentSourcesControllerListPaymentSources**
> paymentSourcesControllerListPaymentSources()


### Example

```typescript
import {
    PaymentSourcesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PaymentSourcesApi(configuration);

const { status, data } = await apiInstance.paymentSourcesControllerListPaymentSources();
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

# **paymentSourcesControllerUpdatePaymentSource**
> paymentSourcesControllerUpdatePaymentSource(body)


### Example

```typescript
import {
    PaymentSourcesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PaymentSourcesApi(configuration);

let id: string; // (default to undefined)
let body: object; //

const { status, data } = await apiInstance.paymentSourcesControllerUpdatePaymentSource(
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

