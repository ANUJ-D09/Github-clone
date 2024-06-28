const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const command = process.argv[2];
const flag = process.argv[3];
const treeSha = process.argv[4];

switch (command) {
    case "init":
        createGitDirectory();
        break;
    case "ls-tree":
        lsTree(treeSha, flag === "--name-only");
        break;
    default:
        throw new Error(`Unknown command ${command}`);
}

function createGitDirectory() {
    const gitPath = path.join(__dirname, ".git");
    const objectsPath = path.join(gitPath, "objects");
    const refsPath = path.join(gitPath, "refs");
    try {
        fs.mkdirSync(gitPath, { recursive: true });
        fs.mkdirSync(objectsPath, { recursive: true });
        fs.mkdirSync(refsPath, { recursive: true });
        fs.writeFileSync(path.join(gitPath, "HEAD"), "ref: refs/heads/main\n");
        console.log("Initialized git directory at:", __dirname);
    } catch (err) {
        console.error("Error initializing git directory:", err);
    }
}

function lsTree(treeSha, nameOnly) {
    try {
        const objectFilePath = getObjectFilePath(treeSha);
        const fileContent = fs.readFileSync(objectFilePath);
        const inflated = zlib.inflateSync(fileContent);

        const entries = parseTreeEntries(inflated);

        if (nameOnly) {
            const names = entries.map(entry => entry.name).join("\n");
            process.stdout.write(names + "\n");
        } else {
            entries.forEach(entry => {
                process.stdout.write(`${entry.mode} ${entry.type} ${entry.sha}    ${entry.name}\n`);
            });
        }
    } catch (err) {
        console.error("Error listing tree:", err);
    }
}

function getObjectFilePath(sha) {
    const objectsDir = path.join(__dirname, ".git", "objects");
    const dirName = sha.slice(0, 2);
    const fileName = sha.slice(2);
    return path.join(objectsDir, dirName, fileName);
}

function parseTreeEntries(buffer) {
    const entries = [];
    let offset = 0;
    while (offset < buffer.length) {
        const spaceIndex = buffer.indexOf(0x20, offset); // Find the space character
        const nullIndex = buffer.indexOf(0x00, spaceIndex); // Find the null character

        const mode = buffer.slice(offset, spaceIndex).toString();
        const name = buffer.slice(spaceIndex + 1, nullIndex).toString();
        const sha = buffer.slice(nullIndex + 1, nullIndex + 21).toString("hex");

        const type = (mode.startsWith("040000")) ? "tree" : "blob";

        entries.push({ mode, type, sha, name });
        offset = nullIndex + 21; // Move offset to next entry
    }
    return entries;
}