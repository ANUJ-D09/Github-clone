const fs = require("fs");
const path = require("path");
const { sha1 } = require("./utils");
const zlib = require("zlib");
const writeBlob = require("./writeBlob");

function writeTree2(root) {
    const filesAndDirs = fs
        .readdirSync(root)
        .filter((f) => f !== ".git" && f !== "main.js");

    const entries = [];
    for (const file of filesAndDirs) {
        const fullPath = path.join(root, file);
        if (fs.statSync(fullPath).isFile()) {
            entries.push({
                mode: 100644,
                name: file,
                hash: writeBlob(true, fullPath),
            });
        } else {
            entries.push({
                mode: 40000,
                name: file,
                hash: writeTree2(path.join(root, file)),
            });
        }
    }

    const contents = entries.reduce((acc, { mode, name, hash }) => {
        return Buffer.concat([
            acc,
            Buffer.from(`${mode} ${name}\0`),
            Buffer.from(hash, "hex"),
        ]);
    }, Buffer.alloc(0));
    const treeContents = Buffer.concat([
        Buffer.from(`tree ${contents.length}\x00`),
        contents,
    ]);
    const treeHash = sha1(treeContents);
    fs.mkdirSync(path.join(root, ".git", "objects", treeHash.slice(0, 2)), {
        recursive: true,
    });
    fs.writeFileSync(
        path.join(root, ".git", "objects", treeHash.slice(0, 2), treeHash.slice(2)),
        zlib.deflateSync(treeContents),
    );
    return treeHash;
}
module.exports = writeTree2;