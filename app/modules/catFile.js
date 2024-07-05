const path = require('path')
const fs = require('fs')
const zlib = require('node:zlib')

function readGitBlob(sha, basePath = '') {
    // Read git blob based on SHA1 hash
    const blobPath = path.resolve(
        basePath,
        '.git',
        'objects',
        sha.slice(0, 2),
        sha.slice(2)
    )

    const data = fs.readFileSync(blobPath)
    const dataUncompressed = zlib.unzipSync(data)

    // Find index header ends
    const nullByteIndex = dataUncompressed.indexOf('\0')
    const blobData = dataUncompressed.toString().slice(nullByteIndex + 1)

    if (dataUncompressed) {
        process.stdout.write(blobData)
        return blobData
    } else {
        throw new Error("Can't decompress git blob")
    }
}

module.exports = readGitBlob