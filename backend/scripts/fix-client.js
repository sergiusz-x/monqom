const fs = require('fs')
const path = require('path')

function prependTsNocheck(dir) {
    const files = fs.readdirSync(dir)
    for (const file of files) {
        const fullPath = path.join(dir, file)
        if (fs.statSync(fullPath).isDirectory()) {
            prependTsNocheck(fullPath)
        } else if (fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8')
            // Remove any existing @ts-nocheck
            content = content.replace(/\/\/ @ts-nocheck\n?/g, '')

            // Insert after eslint-disable to prevent eslint errors
            if (content.includes('/* eslint-disable */')) {
                content = content.replace(
                    '/* eslint-disable */',
                    '/* eslint-disable */\n// @ts-nocheck',
                )
            } else {
                content = '/* eslint-disable */\n// @ts-nocheck\n' + content
            }
            // OpenAPI Generator 5 emits TypeScript-only symbols as runtime imports.
            // Modern bundlers correctly reject those because axios and model barrels
            // do not have matching JavaScript exports.
            content = content
                .replace(
                    /import \{ Configuration \} from (['"]\.\.?\/configuration['"]);/g,
                    'import type { Configuration } from $1;',
                )
                .replace(
                    /import \{ ([A-Za-z0-9]+) \} from (['"](?:\.\.\/model|\.\/[a-z0-9-]+)['"]);/g,
                    'import type { $1 } from $2;',
                )
                .replace(
                    /import \{ AxiosInstance, AxiosResponse \} from ['"]axios['"];/g,
                    "import type { AxiosInstance, AxiosResponse } from 'axios';",
                )
                .replace(
                    /import globalAxios,\s*\{[\s\S]*?\}\s*from ['"]axios['"];/g,
                    "import globalAxios, { type AxiosPromise, type AxiosInstance, type AxiosRequestConfig } from 'axios';",
                )
                .replace(
                    /import \{ RequiredError, (?:type )?RequestArgs \} from (['"]\.\/base['"]);/g,
                    'import { RequiredError, type RequestArgs } from $1;',
                )
                .replace(/type type /g, 'type ')
                .replace(/import type \{ type /g, 'import type { ')
                .replace(/([?:]\s*)type AxiosInstance/g, '$1AxiosInstance')
                .replace(
                    /import \{ RequiredError, RequestArgs \} from (['"]\.\/base['"]);/g,
                    'import { RequiredError, type RequestArgs } from $1;',
                )
            content = content.replace(
                /import \{([^}]+)\} from (['"]\.\.\/base['"]);/g,
                (_match, names, source) =>
                    `import {${names.replace(/(?<!type )\bRequestArgs\b/, 'type RequestArgs')}} from ${source};`,
            )
            content = content.replace(/type type /g, 'type ')
            fs.writeFileSync(fullPath, content, 'utf8')
        }
    }
}

prependTsNocheck(path.join(__dirname, '../../frontend/src/api/client'))
