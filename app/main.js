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
        const treeHash = process.argv[4];
        if (param === "--name-only") {
            lsTree(treeHash, true);
        } else {
            lsTree(param, false);
        }
        break;
    default:
        throw new Error(`Unknown command ${command}`);
}

function createGitDirectory() {
    const gitDir = path.join(process.cwd(), ".git");
    console.log("Initializing git directory at:", gitDir);

    fs.mkdirSync(gitDir, { recursive: true });
    fs.mkdirSync(path.join(gitDir, "objects"), { recursive: true });
    fs.mkdirSync(path.join(gitDir, "refs"), { recursive: true });
    fs.writeFileSync(path.join(gitDir, "HEAD"), "ref: refs/heads/main\n");

    console.log("Initialized git directory successfully.");
}

function readObject(hash) {
    const objectPath = getObjectPath(hash);

    if (!fs.existsSync(objectPath)) {
        throw new Error(`Object with SHA ${hash} does not exist.`);
    }

    const file = fs.readFileSync(objectPath);
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

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const compressed = zlib.deflateSync(content);
    fs.writeFileSync(path.join(dir, hash.slice(2)), compressed);
    process.stdout.write(hash);
}

function lsTree(hash, nameOnly) {
    const objectPath = getObjectPath(hash);

    if (!fs.existsSync(objectPath)) {
        throw new Error(`Tree object with SHA ${hash} does not exist.`);
    }

    const dataFromFile = fs.readFileSync(objectPath);
    const inflated = zlib.inflateSync(dataFromFile);
    const buffer = Buffer.from(inflated);

    let offset = 0;
    while (offset < buffer.length) {
        const spaceIndex = buffer.indexOf(0x20, offset); // Find the space character
        const nullIndex = buffer.indexOf(0x00, spaceIndex); // Find the null character

        if (nullIndex === -1) {
            throw new Error(`Invalid tree object format.`);
        }

        const mode = buffer.slice(offset, spaceIndex).toString('utf-8');
        const filename = buffer.slice(spaceIndex + 1, nullIndex).toString('utf-8');
        const sha = buffer.slice(nullIndex + 1, nullIndex + 20).toString('hex');

        if (nameOnly) {
            process.stdout.write(filename + "\n");
        } else {
            process.stdout.write(`${mode} ${sha} ${filename}\n`);
        }

        offset = nullIndex + 21;
    }
}

function getObjectPath(hash) {
    const dirName = hash.slice(0, 2);
    const fileName = hash.slice(2);
    return path.join(process.cwd(), ".git", "objects", dirName, fileName);
}