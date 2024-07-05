const fs = require("fs");
const path = require("path");
const { sha1 } = require("./utils");
const zlib = require("zlib");
const writeBlobObject = require("./writeBlob");

function writeGitTree(rootDir) {
    const entries = fs
        .readdirSync(rootDir)
        .filter((entry) => entry !== ".git" && entry !== "main.js")
        .map((entry) => {
            const fullPath = path.join(rootDir, entry);
            if (fs.statSync(fullPath).isFile()) {
                return {
                    mode: 100644,
                    name: entry,
                    hash: writeBlobObject(true, fullPath),
                };
            } else {
                return {
                    mode: 40000,
                    name: entry,
                    hash: writeGitTree(fullPath),
                };
            }
        });

    const treeContentsBuffer = entries.reduce((buffer, { mode, name, hash }) => {
        return Buffer.concat([
            buffer,
            Buffer.from(`${mode} ${name}\0`),
            Buffer.from(hash, "hex"),
        ]);
    }, Buffer.alloc(0));

    const treeHeader = Buffer.from(`tree ${treeContentsBuffer.length}\x00`);
    const fullTreeBuffer = Buffer.concat([treeHeader, treeContentsBuffer]);
    const treeHash = sha1(fullTreeBuffer);

    const objectDir = path.join(rootDir, ".git", "objects", treeHash.slice(0, 2));
    const objectPath = path.join(objectDir, treeHash.slice(2));

    fs.mkdirSync(objectDir, { recursive: true });
    fs.writeFileSync(objectPath, zlib.deflateSync(fullTreeBuffer));

    return treeHash;
}

module.exports = writeGitTree;