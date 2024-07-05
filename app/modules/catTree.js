const fs = require("fs");
const path = require("path");
const zlib = require("node:zlib");
const { resolveGitObjectPath } = require("./utils");

function readTree(hash) {
    const path = require("path");
    const fs = require("fs");
    const zlib = require("zlib");
    const dirName = hash.slice(0, 2);
    const fileName = hash.slice(2);
    const objectPath = path.join(".git", "objects", dirName, fileName);
    if (!fs.existsSync(objectPath)) {
        throw new Error("Object path does not exist");
    }
    const dataFromFile = fs.readFileSync(objectPath);
    // Decompress the data from the file using zlib
    const decompressedData = zlib.inflateSync(dataFromFile);
    // Convert the buffer to a string while preserving the byte structure
    let dataStr = decompressedData.toString("binary");
    // Find the end of the object header ("tree <size>\0")
    let nullByteIndex = dataStr.indexOf("\0");
    dataStr = dataStr.slice(nullByteIndex + 1);
    const entries = [];
    while (dataStr.length > 0) {
        // Extract mode
        const spaceIndex = dataStr.indexOf(" ");
        if (spaceIndex === -1) break; // Invalid format
        const mode = dataStr.slice(0, spaceIndex);
        dataStr = dataStr.slice(spaceIndex + 1);
        // Extract name
        const nullIndex = dataStr.indexOf("\0");
        if (nullIndex === -1) break; // Invalid format
        const name = dataStr.slice(0, nullIndex);
        if (!name) continue; // skip empty names
        dataStr = dataStr.slice(nullIndex + 1); // Move past the null byte
        // Extract SHA-1 hash
        const sha = dataStr.slice(0, 20);
        dataStr = dataStr.slice(20);
        entries.push(name);
    }
    // Output the names of the files and directories
    const response = entries.join("\n"); // Removed the trailing newline for better handling
    if (response) {
        process.stdout.write(response + "\n"); // Append newline here
    } else {
        throw new Error("No valid entries found");
    }
}
module.exports = readTree;