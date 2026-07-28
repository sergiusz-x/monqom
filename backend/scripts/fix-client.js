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
            fs.writeFileSync(fullPath, content, 'utf8')
        }
    }
}

prependTsNocheck(path.join(__dirname, '../../frontend/src/api/client'))
