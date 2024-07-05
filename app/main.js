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
        if (!hash) {
            console.error("Error: No hash provided for cat-file command.");
            process.exit(1);
        }
        if (param === "-p") readObject(hash);
        break;

    case "hash-object":
        const file = process.argv[4];
        if (!file) {
            console.error("Error: No file provided for hash-object command.");
            process.exit(1);
        }
        if (param === "-w") hashObject(file);
        break;
    case "ls-tree":
        createTree();
        break;
    default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
}

function createTree() {
    const flag = process.argv[3];
    if (flag == "--name-only") {
        const sha = process.argv[4];
        const directory = sha.slice(0, 2);
        const fileName = sha.slice(2);
        const filePath = path.join(__dirname, ".git", "objects", directory, fileName);
        let inflatedContent = zlib.inflateSync(fs.readFileSync(filePath)).toString().split('\0');
        let content = inflatedContent.slice(1).filter(value => value.includes(" "));
        let names = content.map(value => value.split(" ")[1]);
        names.forEach((name) => process.stdout.write(`${name}\n`));
    }
}

function createGitDirectory() {
    try {
        const gitDir = path.join(process.cwd(), ".git");
        fs.mkdirSync(gitDir, { recursive: true });
        fs.mkdirSync(path.join(gitDir, "objects"), { recursive: true });
        fs.mkdirSync(path.join(gitDir, "refs"), { recursive: true });
        fs.writeFileSync(path.join(gitDir, "HEAD"), "ref: refs/heads/main\n");
        console.log("Initialized git directory");
    } catch (error) {
        console.error(`Error initializing git directory: ${error.message}`);
    }
}

function readObject(hash) {
    try {
        const filePath = path.join(process.cwd(), ".git", "objects", hash.slice(0, 2), hash.slice(2));
        const fileContent = fs.readFileSync(filePath);
        const inflatedContent = zlib.inflateSync(fileContent);
        let content = inflatedContent.toString();
        content = content.slice(content.indexOf("\0") + 1);
        process.stdout.write(content);
    } catch (error) {
        console.error(`Error reading object: ${error.message}`);
    }
}

function hashObject(file) {
    try {
        const filePath = path.join(process.cwd(), file);
        const fileContent = fs.readFileSync(filePath);
        const header = `blob ${fileContent.length}\0`;
        const content = Buffer.concat([Buffer.from(header), fileContent]);
        const hash = crypto.createHash("sha1").update(content).digest("hex");

        const dir = path.join(process.cwd(), ".git", "objects", hash.slice(0, 2));
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const compressedContent = zlib.deflateSync(content);
        fs.writeFileSync(path.join(dir, hash.slice(2)), compressedContent);
        process.stdout.write(hash);
    } catch (error) {
        console.error(`Error hashing object: ${error.message}`);
    }
}