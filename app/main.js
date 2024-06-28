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
        const treeHash = process.argv[4];
        lsTree(treeHash, param === "--name-only");
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

function lsTree(treeHash, nameOnly) {
    const objectPath = path.join(process.cwd(), '.git', 'objects', treeHash.slice(0, 2), treeHash.slice(2));

    if (!fs.existsSync(objectPath)) {
        throw new Error(`Tree object with SHA ${treeHash} does not exist.`);
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

        if (nameOnly) {
            process.stdout.write(filename + "\n");
        } else {
            process.stdout.write(`${mode} ${filename}\n`);
        }

        offset = nullIndex + 21;
    }
}