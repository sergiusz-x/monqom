import { createLogger, format, transports, Logger, Logform } from 'winston'

const { combine, timestamp, printf, colorize, json } = format

// Custom console format for development (human-readable)
const devFormat = printf((info: Logform.TransformableInfo) => {
    const { level, message, timestamp, service, context, request_id, ...metadata } = info;
    let msg = `${timestamp} [${service || 'app'}] ${level}: ${message}`
    
    // Append request ID if present
    if (request_id) {
        msg += ` [req: ${request_id}]`
    }
    
    // Append additional context/metadata if present
    if (context) {
        msg += ` \n Context: ${JSON.stringify(context)}`
    } else if (Object.keys(metadata).length > 0) {
        msg += ` \n Metadata: ${JSON.stringify(metadata)}`
    }
    
    return msg
})

export const logger: Logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service: 'api' },
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        process.env.NODE_ENV === 'production' 
            ? json() 
            : combine(colorize(), devFormat)
    ),
    transports: [
        new transports.Console()
    ]
})
