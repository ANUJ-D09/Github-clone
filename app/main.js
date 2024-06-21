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