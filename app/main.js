const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const command = process.argv[2];
const param = process.argv[3];

switch (command) {
    case "init":
        createGitDirectory();
        break;
    case "cat-file":
        const hash = process.argv[4];
        if (param === "-p") readObject(hash);
        break;
    case "hash-object":
        const file = process.argv[4];
        if (param === "-w") hashObject(file);
        break;
    case "ls-tree":
        const flag = process.argv[3];
        const treeSha = process.argv[4];
        lsTree(treeSha, flag === "--name-only");
        break;
    default:
        throw new Error(`Unknown command ${command}`);
}

function createGitDirectory() {
    console.log(process.cwd());
    fs.mkdirSync(path.join(process.cwd(), ".git"), { recursive: true });
    fs.mkdirSync(path.join(process.cwd(), ".git", "objects"), { recursive: true });
    fs.mkdirSync(path.join(process.cwd(), ".git", "refs"), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), ".git", "HEAD"), "ref: refs/heads/main\n");
    console.log("Initialized git directory");
}

function readObject(hash) {
    const file = fs.readFileSync(getObjectFilePath(hash));
    const inflated = zlib.inflateSync(file);
    let content = inflated.toString();

    content = content.slice(content.indexOf("\0") + 1).replace(/\n/g, "");
    process.stdout.write(content);
}

function hashObject(file) {
    const fileContent = fs.readFileSync(path.join(process.cwd(), file));
    const header = `blob ${fileContent.length}\0`;
    const content = Buffer.concat([Buffer.from(header), fileContent]);
    const hash = crypto.createHash("sha1").update(content).digest("hex");
    const dir = path.join(process.cwd(), ".git", "objects", hash.slice(0, 2));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const compressed = zlib.deflateSync(content);
    fs.writeFileSync(path.join(dir, hash.slice(2)), compressed);
    process.stdout.write(hash);
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