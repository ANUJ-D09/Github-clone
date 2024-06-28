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
        const flag = process.argv[3];
        const blobSha = process.argv[4];
        createObject(flag, blobSha);
        break;
    case "hash-object":
        hashObject();
        break;
    case "ls-tree":
        lsTree();
        break;
    default:
        throw new Error(`Unknown command ${command}`);
}



function createObject(flag, blobSha) {
    const dirName = blobSha.slice(0, 2);
    const fileName = blobSha.slice(2);
    const filePath = path.join(__dirname, ".git", "objects", dirName, fileName);
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath);
        if (flag === "-t") {
            // Print object type
            const inflatedData = zlib.inflateSync(fileContent);
            const headerEndIndex = inflatedData.indexOf(0x00); // Find the null byte separator
            const objectType = inflatedData.slice(0, headerEndIndex).toString("utf-8");
            process.stdout.write(objectType);
        } else if (flag === "-p") {
            // Print object content
            const inflatedContent = zlib.inflateSync(fileContent).toString();
            const [header, blobContent] = inflatedContent.split("\0");
            process.stdout.write(blobContent);
        } else {
            throw new Error(`Invalid flag: ${flag}`);
        }
    } else {
        throw new Error(`Object with SHA ${blobSha} does not exist.`);
    }
}

function hashObject(file) {
    const fileContent = fs.readFileSync(path.join(process.cwd(), file));
    const header = blob $ { fileContent.length }\
    0;
    const content = Buffer.concat([Buffer.from(header), fileContent]);
    const hash = crypto.createHash("sha1").update(content).digest("hex");
    const dir = path.join(process.cwd(), ".git", "objects", hash.slice(0, 2));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const compressed = zlib.deflateSync(content);
    fs.writeFileSync(path.join(dir, hash.slice(2)), compressed);
    process.stdout.write(hash);
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

function lsTree() {
    const flag = process.argv[3];
    const treeSha = process.argv[4];

    const dirName = treeSha.slice(0, 2);
    const fileName = treeSha.slice(2);
    const filePath = path.join(__dirname, ".git", "objects", dirName, fileName);

    if (!fs.existsSync(filePath)) {
        throw new Error(`Tree object with SHA ${treeSha} does not exist.`);
    }

    const fileContent = fs.readFileSync(filePath);
    const inflatedData = zlib.inflateSync(fileContent);
    const entries = inflatedData.toString("utf-8").split("\0").filter(entry => entry.length > 0);

    if (flag === "--name-only") {
        const names = entries.map(entry => {
            const [mode, name] = entry.split(" ")[1].split("\t");
            return name;
        });
        names.forEach(name => process.stdout.write(`${name}\n`));
    } else {
        entries.forEach(entry => {
            const [mode, details] = entry.split(" ");
            const sha = details.slice(0, 40);
            const name = details.slice(41);
            process.stdout.write(`${mode} ${sha} ${name}\n`);
        });
    }
}