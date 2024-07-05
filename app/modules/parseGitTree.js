const fs = require('fs')
const zlib = require('zlib')

function parseTreeObject(decompressedData) {
    console.log(decompressedData)
    let i = 0
    const entries = []

    while (i < decompressedData.length) {
        // Parse mode
        const spaceIndex = decompressedData.indexOf(' ', i)
        const mode = decompressedData.slice(i, spaceIndex).toString('utf8')
        i = spaceIndex + 1

        // Parse filename
        const nullIndex = decompressedData.indexOf('\0', i)
        const filename = decompressedData.slice(i, nullIndex).toString('utf8')
        i = nullIndex + 1

        // Parse SHA-1 hash
        const hash = decompressedData.slice(i, i + 20)
        i += 20

        // Push entry to the list
        entries.push({ mode, filename, hash: hash.toString('hex') })
    }

    return entries
}

module.exports = parseTreeObject