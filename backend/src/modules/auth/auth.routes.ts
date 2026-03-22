export const AUTH_BASE_ROUTE = 'auth'

export const AUTH_ROUTES = {
    register: 'register',
    login: 'login',
    forgotPassword: 'forgot-password',
    resetPassword: 'reset-password',
    logout: 'logout',
    me: 'me',
    verifyEmail: 'verify-email',
    resendVerification: 'resend-verification',
} as const
