const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const zlib = require("zlib");
const command = process.argv[2];
switch (command) {
    case "init":
        createGitDirectory();
        break;
    case "cat-file":
        catFile();
        break;
    case "hash-object":
        hashObject();
        break;
    default:
        throw new Error(`Unknown command ${command}`);
}
require("zlib");

function createGitDirectory() {
    fs.mkdirSync(path.join(__dirname, ".git"), { recursive: true });
    fs.mkdirSync(path.join(__dirname, ".git", "objects"), { recursive: true });
    fs.mkdirSync(path.join(__dirname, ".git", "refs"), { recursive: true });
    fs.writeFileSync(path.join(__dirname, ".git", "HEAD"), "ref: refs/heads/master\n");
    console.log("Initialized git directory");
}
async function catFile() {
    const blob = process.argv[4];
    const directoryName = blob.slice(0, 2);
    const fileName = blob.slice(2);
    const data = fs.readFileSync(path.join(__dirname, ".git", "objects", directoryName, fileName));
    const uncompressed = zlib.inflateSync(data).toString();
    const [type, content] = uncompressed.split("\x00");
    process.stdout.write(content);
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