# HealthApi

All URIs are relative to *http://localhost*

| Method                                                          | HTTP request          | Description |
| --------------------------------------------------------------- | --------------------- | ----------- |
| [**healthControllerCheckHealth**](#healthcontrollercheckhealth) | **GET** /health       |             |
| [**healthControllerCheckReady**](#healthcontrollercheckready)   | **GET** /ready        |             |
| [**healthControllerVersion**](#healthcontrollerversion)         | **GET** /version.json |             |

# **healthControllerCheckHealth**

> HealthControllerCheckHealth200Response healthControllerCheckHealth()

### Example

```typescript
import { HealthApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new HealthApi(configuration);

const { status, data } = await apiInstance.healthControllerCheckHealth();
```

### Parameters

This endpoint does not have any parameters.

### Return type

**HealthControllerCheckHealth200Response**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description                        | Response headers |
| ----------- | ---------------------------------- | ---------------- |
| **200**     | The Health Check is successful     | -                |
| **503**     | The Health Check is not successful | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **healthControllerCheckReady**

> healthControllerCheckReady()

### Example

```typescript
import { HealthApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new HealthApi(configuration);

const { status, data } = await apiInstance.healthControllerCheckReady();
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

# **healthControllerVersion**

> healthControllerVersion()

### Example

```typescript
import { HealthApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new HealthApi(configuration);

const { status, data } = await apiInstance.healthControllerVersion();
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
