export const AUTH_BASE_ROUTE = 'auth'

export const AUTH_ROUTES = {
    register: 'register',
    login: 'login',
    twoFactorSetup: '2fa/setup',
    twoFactorVerifySetup: '2fa/verify-setup',
    twoFactorVerify: '2fa/verify',
    twoFactorDisable: '2fa/disable',
    forgotPassword: 'forgot-password',
    resetPassword: 'reset-password',
    logout: 'logout',
    me: 'me',
    verifyEmail: 'verify-email',
    resendVerification: 'resend-verification',
} as const
