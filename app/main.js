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
        const flag = process.argv[3];
        const treeSha = process.argv[4];
        lsTree(treeSha, flag === "--name-only");
        break;
    default:
        throw new Error(`Unknown command ${command}`);
}

function createGitDirectory() {
    const gitDir = path.join(process.cwd(), ".git"); // Use current working directory

    // Create Git directory structure (handle potential errors gracefully)
    try {
        fs.mkdirSync(gitDir, { recursive: true });
        fs.mkdirSync(path.join(gitDir, "objects"), { recursive: true });
        fs.mkdirSync(path.join(gitDir, "refs"), { recursive: true });
        fs.writeFileSync(path.join(gitDir, "HEAD"), "ref: refs/heads/main\n");
    } catch (err) {
        console.error("Error creating Git directory:", err);
        process.exit(1); // Exit with error code if creation fails
    }

    console.log("Initialized git directory");
}

function readObject(hash) {
    const objectFilePath = getObjectFilePath(hash);

    try {
        const file = fs.readFileSync(objectFilePath);
        const inflated = zlib.inflateSync(file);
        let content = inflated.toString();
        content = content.slice(content.indexOf("\0") + 1).replace(/\n/g, "");
        process.stdout.write(content);
    } catch (err) {
        console.error("Error reading object:", err);
    }
}

function hashObject(file) {
    const filePath = path.join(process.cwd(), file); // Use current working directory

    try {
        const fileContent = fs.readFileSync(filePath);
        const header = `blob ${fileContent.length}\0`;
        const content = Buffer.concat([Buffer.from(header), fileContent]);
        const hash = crypto.createHash("sha1").update(content).digest("hex");
        const dir = path.join(process.cwd(), ".git", "objects", hash.slice(0, 2));
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const compressed = zlib.deflateSync(content);
        fs.writeFileSync(path.join(dir, hash.slice(2)), compressed);
        process.stdout.write(hash);
    } catch (err) {
        console.error("Error hashing object:", err);
    }
}

function lsTree(treeSha, nameOnly) {
    const objectFilePath = getObjectFilePath(treeSha);

    try {
        const fileContent = fs.readFileSync(objectFilePath);
        const inflated = zlib.inflateSync(fileContent);
        const entries = parseTreeEntries(inflated);

        if (nameOnly) {
            const names = entries.map(entry => entry.name).join("\n");
            process.stdout.write(names + "\n");
        } else {
            entries.forEach(entry => {
                process.stdout.write(`${entry.mode} ${entry.type} ${entry.sha}    ${entry.name}\n`);
            });
        }
    } catch (err) {
        console.error("Error listing tree:", err);
    }
}

function getObjectFilePath(sha) {
    const gitDir = path.join(process.cwd(), ".git"); // Use current working directory
    const objectsDir = path.join(gitDir, "objects");
    const dirName = sha.slice(0, 2);
    const fileName = sha.slice(2);
    return path.join(objectsDir, dirName, fileName);