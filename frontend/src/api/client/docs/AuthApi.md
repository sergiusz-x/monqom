# AuthApi

All URIs are relative to *http://localhost*

| Method                                                                        | HTTP request                       | Description |
| ----------------------------------------------------------------------------- | ---------------------------------- | ----------- |
| [**authControllerChangePassword**](#authcontrollerchangepassword)             | **POST** /auth/change-password     |             |
| [**authControllerDisableTwoFactor**](#authcontrollerdisabletwofactor)         | **POST** /auth/2fa/disable         |             |
| [**authControllerForgotPassword**](#authcontrollerforgotpassword)             | **POST** /auth/forgot-password     |             |
| [**authControllerGetCsrfToken**](#authcontrollergetcsrftoken)                 | **GET** /auth/csrf-token           |             |
| [**authControllerLogin**](#authcontrollerlogin)                               | **POST** /auth/login               |             |
| [**authControllerLogout**](#authcontrollerlogout)                             | **POST** /auth/logout              |             |
| [**authControllerMe**](#authcontrollerme)                                     | **GET** /auth/me                   |             |
| [**authControllerRegister**](#authcontrollerregister)                         | **POST** /auth/register            |             |
| [**authControllerResendVerification**](#authcontrollerresendverification)     | **POST** /auth/resend-verification |             |
| [**authControllerResetPassword**](#authcontrollerresetpassword)               | **POST** /auth/reset-password      |             |
| [**authControllerSetupTwoFactor**](#authcontrollersetuptwofactor)             | **POST** /auth/2fa/setup           |             |
| [**authControllerVerifyEmail**](#authcontrollerverifyemail)                   | **POST** /auth/verify-email        |             |
| [**authControllerVerifyTwoFactor**](#authcontrollerverifytwofactor)           | **POST** /auth/2fa/verify          |             |
| [**authControllerVerifyTwoFactorSetup**](#authcontrollerverifytwofactorsetup) | **POST** /auth/2fa/verify-setup    |             |

# **authControllerChangePassword**

> authControllerChangePassword(body)

### Example

```typescript
import { AuthApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

let body: object; //

const { status, data } = await apiInstance.authControllerChangePassword(body);
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

# **authControllerDisableTwoFactor**

> authControllerDisableTwoFactor(body)

### Example

```typescript
import { AuthApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

let body: object; //

const { status, data } = await apiInstance.authControllerDisableTwoFactor(body);
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

# **authControllerForgotPassword**

> authControllerForgotPassword(body)

### Example

```typescript
import { AuthApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

let body: object; //

const { status, data } = await apiInstance.authControllerForgotPassword(body);
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

# **authControllerGetCsrfToken**

> authControllerGetCsrfToken()

### Example

```typescript
import { AuthApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

const { status, data } = await apiInstance.authControllerGetCsrfToken();
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

# **authControllerLogin**

> authControllerLogin(body)

### Example

```typescript
import { AuthApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

let body: object; //

const { status, data } = await apiInstance.authControllerLogin(body);
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

# **authControllerLogout**

> authControllerLogout()

### Example

```typescript
import { AuthApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

const { status, data } = await apiInstance.authControllerLogout();
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

# **authControllerMe**

> authControllerMe()

### Example

```typescript
import { AuthApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

const { status, data } = await apiInstance.authControllerMe();
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

# **authControllerRegister**

> authControllerRegister(body)

### Example

```typescript
import { AuthApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

let body: object; //

const { status, data } = await apiInstance.authControllerRegister(body);
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

# **authControllerResendVerification**

> authControllerResendVerification(body)

### Example

```typescript
import { AuthApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

let body: object; //

const { status, data } =
  await apiInstance.authControllerResendVerification(body);
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

# **authControllerResetPassword**

> authControllerResetPassword(body)

### Example

```typescript
import { AuthApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

let body: object; //

const { status, data } = await apiInstance.authControllerResetPassword(body);
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

# **authControllerSetupTwoFactor**

> authControllerSetupTwoFactor()

### Example

```typescript
import { AuthApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

const { status, data } = await apiInstance.authControllerSetupTwoFactor();
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

# **authControllerVerifyEmail**

> authControllerVerifyEmail(body)

### Example

```typescript
import { AuthApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

let body: object; //

const { status, data } = await apiInstance.authControllerVerifyEmail(body);
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

# **authControllerVerifyTwoFactor**

> authControllerVerifyTwoFactor(body)

### Example

```typescript
import { AuthApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

let body: object; //

const { status, data } = await apiInstance.authControllerVerifyTwoFactor(body);
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

# **authControllerVerifyTwoFactorSetup**

> authControllerVerifyTwoFactorSetup(body)

### Example

```typescript
import { AuthApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

let body: object; //

const { status, data } =
  await apiInstance.authControllerVerifyTwoFactorSetup(body);
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
