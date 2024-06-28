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
    console.log(process.cwd());
    fs.mkdirSync(path.join(process.cwd(), ".git"), { recursive: true });
    fs.mkdirSync(path.join(process.cwd(), ".git", "objects"), { recursive: true });
    fs.mkdirSync(path.join(process.cwd(), ".git", "refs"), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), ".git", "HEAD"), "ref: refs/heads/main\n");
    console.log("Initialized git directory");
}

function readObject(hash) {
    const file = fs.readFileSync(path.join(process.cwd(), ".git", "objects", hash.slice(0, 2), hash.slice(2)));
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

function lsTree(hash, nameOnly) {
    const dirName = hash.slice(0, 2);
    const fileName = hash.slice(2);
    const objectPath = path.join(process.cwd(), '.git', 'objects', dirName, fileName);
    const dataFromFile = fs.readFileSync(objectPath);
    const inflated = zlib.inflateSync(dataFromFile);

    let offset = 0;
    while (offset < inflated.length) {
        const spaceIndex = inflated.indexOf(0x20, offset);
        const nullIndex = inflated.indexOf(0x00, spaceIndex);

        if (spaceIndex === -1 || nullIndex === -1) break;

        const mode = inflated.slice(offset, spaceIndex).toString();
        const filename = inflated.slice(spaceIndex + 1, nullIndex).toString();
        const hash = inflated.slice(nullIndex + 1, nullIndex + 21).toString('hex');

        if (nameOnly) {
            process.stdout.write(filename + "\n");
        } else {
            process.stdout.write(`${mode} ${hash} ${filename}\n`);
        }

        offset = nullIndex + 21;
    }
}