const fs = require("fs");
const path = require("path");
const { readGitObject, parseTreeEntries } = require("./utils");

function checkout(hash, gitDir, basePath = "") {
    const { type, length, content } = readGitObject(hash, gitDir);
    if (type !== "tree") {
        throw new Error("Not a tree");
    }
    let entries = parseTreeEntries(content);
    for (let entry of entries) {
        if (entry.mode === "100644") {
            const blob = readGitObject(entry.hash, gitDir);
            //console.log(path.join(basePath, entry.name));
            fs.writeFileSync(path.join(basePath, entry.name), blob.content);
        } else if (entry.mode === "40000") {
            //console.log("FOUND FOLDER", entry.hash);
            let folder = path.join(basePath, entry.name);
            fs.mkdirSync(folder);
            checkout(entry.hash, gitDir, folder);
        }
    }
}

module.exports = checkout;