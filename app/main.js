const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const command = process.argv[2];

switch (command) {
    case "init":
        createGitDirectory();
        break;
    case 'cat-file':
        const hash = process.argv[4];
        catFile(hash);
        break;

    case 'hash-object':
        hashObject();
        break;
    default:
        throw new Error(`Unknown command ${command}`);
}

function createGitDirectory() {
    fs.mkdirSync(path.join(process.cwd(), ".git"), { recursive: true });
    fs.mkdirSync(path.join(process.cwd(), ".git", "objects"), { recursive: true });
    fs.mkdirSync(path.join(process.cwd(), ".git", "refs"), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), ".git", "HEAD"), "ref: refs/heads/main\n");
    console.log("Initialized git directory");
}
async function catFile(hash) {
    const content = await fs.readFileSync(path.join(process.cwd(), ".git", "objects", hash.slice(0, 2), hash.slice(2)));
    const dataUnzipped = zlib.inflateSync(content);
    const res = dataUnzipped.toString().split('\0')[1];
    process.stdout.write(res);
}

function hashObject() {
    const writeCommand = process.argv[3];
    if (writeCommand !== "-w") return;
    const file = process.argv[4];
    const content = fs.readFileSync(file);
    const header = `blob ${content.length}\x00`;
    const data = header + content;
    const hash = crypto.createHash("sha1").update(data).digest("hex");
    const objectsDirPath = path.join(__dirname, ".git", "objects");
    const hashDirPath = path.join(objectsDirPath, hash.slice(0, 2));
    const filePath = path.join(hashDirPath, hash.slice(2));
    fs.mkdirSync(hashDirPath, { recursive: true });
    fs.writeFileSync(filePath, zlib.deflateSync(data));
    process.stdout.write(hash);
}