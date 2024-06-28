const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");

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
        lsTree(process.argv.slice(3));
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

function readObject(hash) {
    try {
        const filePath = path.join(__dirname, ".git", "objects", hash.slice(0, 2), hash.slice(2));
        console.log("Reading object from:", filePath);
        const file = fs.readFileSync(filePath);
        const inflated = zlib.inflateSync(file);
        let content = inflated.toString();
        content = content.slice(content.indexOf("\0") + 1).replace(/\n/g, "");
        process.stdout.write(content);
    } catch (err) {
        console.error("Error reading object:", err);
    }
}

function hashObject(file) {
    try {
        const filePath = path.join(__dirname, file);
        console.log("Hashing object from:", filePath);
        const fileContent = fs.readFileSync(filePath);
        const header = `blob ${fileContent.length}\0`;
        const content = Buffer.concat([Buffer.from(header), fileContent]);
        const hash = crypto.createHash("sha1").update(content).digest("hex");
        const objectsDir = path.join(__dirname, ".git", "objects", hash.slice(0, 2));
        fs.mkdirSync(objectsDir, { recursive: true });
        const compressed = zlib.deflateSync(content);
        fs.writeFileSync(path.join(objectsDir, hash.slice(2)), compressed);
        process.stdout.write(hash);
    } catch (err) {
        console.error("Error hashing object:", err);
    }
}

function lsTree(args) {
    try {
        const [flag, hash] = args;
        const objectPath = path.join(__dirname, ".git", "objects", hash.slice(0, 2), hash.slice(2));
        console.log("Listing tree from:", objectPath);
        const compressed = fs.readFileSync(objectPath);
        const inflated = zlib.inflateSync(compressed);
        const entries = parseTreeEntries(inflated);
        if (flag === "--name-only") {
            const names = entries.map(entry => entry.name).join("\n");
            process.stdout.write(names + "\n");
        } else {
            entries.forEach(entry => {
                process.stdout.write(`${entry.mode} ${entry.hash} ${entry.name}\n`);
            });
        }
    } catch (err) {
        console.error("Error listing tree:", err);
    }
}

function parseTreeEntries(buffer) {
    const entries = [];
    let offset = 0;
    while (offset < buffer.length) {
        const spaceIndex = buffer.indexOf(0x20, offset); // Find the space character
        const nullIndex = buffer.indexOf(0x00, spaceIndex); // Find the null character

        const mode = buffer.slice(offset, spaceIndex).toString();
        const name = buffer.slice(spaceIndex + 1, nullIndex).toString();
        const hash = buffer.slice(nullIndex + 1, nullIndex + 21).toString('hex');

        entries.push({ mode, name, hash });
        offset = nullIndex + 21;
    }
    return entries;
}