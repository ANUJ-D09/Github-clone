const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");

const command = process.argv[2];

switch (command) {
    case "init":
        createGitDirectory();
        break;
    case "cat-file":
        getCatFile();
        break;
    case "hash-object":
        createSHA();
        break;
    case "ls-tree":
        listTree();
        break;
    default:
        throw new Error(`Unknown command ${command}`);
}

function createGitDirectory() {
    fs.mkdirSync(path.join(__dirname, ".git"), { recursive: true });
    fs.mkdirSync(path.join(__dirname, ".git", "objects"), { recursive: true });
    fs.mkdirSync(path.join(__dirname, ".git", "refs"), { recursive: true });
    fs.writeFileSync(path.join(__dirname, ".git", "HEAD"), "ref: refs/heads/main\n");
    console.log("Initialized git directory");
}

function createSHA() {
    const flag = process.argv[3];
    if (flag === "-w") {
        const file = process.argv[4];
        const fileContent = fs.readFileSync(file, "utf-8");
        const header = `blob ${fileContent.length}\0`;
        const store = header + fileContent;
        const hash = crypto.createHash("sha1").update(store).digest("hex");
        const directory = hash.substring(0, 2);
        const fileName = hash.substring(2);
        const filePath = path.join(__dirname, ".git", "objects", directory, fileName);
        fs.mkdirSync(path.join(__dirname, ".git", "objects", directory), { recursive: true });
        fs.writeFileSync(filePath, zlib.deflateSync(store));
        console.log(hash); // prints a 40-character SHA hash to stdout
    }
}

function getCatFile() {
    const flag = process.argv[3];
    if (flag === "-p") {
        const hash_val = process.argv[4];
        const objHashDir = hash_val.slice(0, 2);
        const blobFileName = hash_val.slice(2);
        const filePath = path.join(__dirname, ".git", "objects", objHashDir, blobFileName);
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath);
            const uncompressedContent = zlib.inflateSync(fileContent).toString();
            const [header, blobContent] = uncompressedContent.split("\0");
            console.log(blobContent);
        } else {
            console.log("File does not exist!");
        }
    }
}

function listTree() {
    const flag = process.argv[3];
    if (flag === "--name-only") {
        const treeSha = process.argv[4];
        const directory = treeSha.slice(0, 2);
        const fileName = treeSha.slice(2);
        const filePath = path.join(__dirname, ".git", "objects", directory, fileName);

        if (!fs.existsSync(filePath)) {
            console.error(`Error listing tree: Object file not found: ${filePath}`);
            return;
        }

        const fileContent = fs.readFileSync(filePath);
        const inflatedContent = zlib.inflateSync(fileContent).toString();
        const entries = inflatedContent.split("\0").slice(1).filter(value => value.includes(" "));
        const names = entries.map(value => value.split(" ")[1]);

        names.forEach(name => console.log(name));
    }
}