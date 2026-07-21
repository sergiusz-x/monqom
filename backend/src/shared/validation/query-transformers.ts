import type { TransformFnParams } from 'class-transformer'

export function transformBooleanQuery({ value }: TransformFnParams): unknown {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
}

export function transformStringArrayQuery({ value }: TransformFnParams): unknown {
    if (Array.isArray(value)) return value
    if (typeof value === 'string') return value.split(',').filter((item) => item.length > 0)
    return value
}
