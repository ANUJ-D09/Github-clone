const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");

const command = process.argv[2];
const param = process.argv[3];

function initializeGitDirectory() {
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

function getSHA1(input) {
    return crypto.createHash("sha1").update(input).digest("hex");
}

function displayObject(hash) {
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

function computeHashObject(file) {
    try {
        const filePath = path.join(process.cwd(), file);
        const fileContent = fs.readFileSync(filePath);
        const header = `blob ${fileContent.length}\0`;
        const content = Buffer.concat([Buffer.from(header), fileContent]);
        const hash = getSHA1(content);

        const dir = path.join(process.cwd(), ".git", "objects", hash.slice(0, 2));
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const compressedContent = zlib.deflateSync(content);
        fs.writeFileSync(path.join(dir, hash.slice(2)), compressedContent);
        process.stdout.write(hash);
    } catch (error) {
        console.error(`Error hashing object: ${error.message}`);
    }
}

function printObject(objectSHA) {
    const objectPath = path.join(
        process.cwd(),
        ".git",
        "objects",
        objectSHA.slice(0, 2),
        objectSHA.slice(2)
    );
    const objectContent = fs.readFileSync(objectPath, "base64");
    const compressedData = Buffer.from(objectContent, "base64");
    zlib.unzip(compressedData, (err, buffer) => {
        if (err) {
            console.error("Error uncompressing data:", err);
        } else {
            const uncompressedData = buffer.toString("utf-8");
            const objectType = uncompressedData.split(" ")[0];
            switch (objectType) {
                case "blob":
                    printBlob(uncompressedData);
                    break;
                case "tree":
                    printTree(uncompressedData);
                    break;
                case "commit":
                    console.log("commit");
                    break;
                default:
                    console.log("Unknown object type:", objectType);
            }
        }
    });
}

function printBlob(uncompressedData) {
    const content = uncompressedData.split("\x00")[1];
    process.stdout.write(content);
}

function printTree(uncompressedData) {
    const entries = uncompressedData.split("\x00");
    // Removing the header
    entries.shift();
    // Removing the last SHA
    entries.pop();
    for (const entry of entries) {
        const path = entry.split(" ")[1];
        path && console.log(path);
    }
}

const writeBlob = (filePath) => {
    const fileData = fs.readFileSync(filePath, "utf-8");
    const dataToBeHashed = `blob ${fileData.length}\x00${fileData}`;
    const hashedData = getSHA1(dataToBeHashed);
    const compressedData = zlib.deflateSync(dataToBeHashed);
    fs.mkdirSync(
        `${path.join(__dirname, ".git", "objects")}/${hashedData.substring(0, 2)}`, { recursive: true }
    );
    fs.writeFileSync(
        `${path.join(__dirname, ".git", "objects")}/${hashedData.substring(
            0, 2
        )}/${hashedData.substring(2)}`,
        compressedData
    );
    return hashedData;
};

const createTree = (dirPath) => {
    const filesAndDir = fs
        .readdirSync(dirPath)
        .filter((file) => file !== ".git" && file !== "main.js");
    const entries = [];
    for (let file of filesAndDir) {
        const fullPath = path.join(dirPath, file);
        if (fs.lstatSync(fullPath).isDirectory()) {
            entries.push({
                mode: 40000,
                name: file,
                hash: createTree(fullPath),
            });
        } else {
            entries.push({
                mode: 100644,
                name: file,
                hash: writeBlob(fullPath),
            });
        }
    }
    let entriesBuffer = Buffer.alloc(0);
    for (let entry of entries) {
        entriesBuffer = Buffer.concat([
            entriesBuffer,
            Buffer.from(`${entry.mode} ${entry.name}\0`),
            Buffer.from(entry.hash, "hex"),
        ]);
    }
    const treeBuffer = Buffer.concat([
        Buffer.from(`tree ${entriesBuffer.length}\x00`),
        entriesBuffer,
    ]);
    const compressedTree = zlib.deflateSync(treeBuffer);
    const treeHash = getSHA1(treeBuffer);
    const dir = treeHash.slice(0, 2);
    const fileName = treeHash.slice(2);
    fs.mkdirSync(`${path.join(dirPath, ".git", "objects")}/${dir}`, {
        recursive: true,
    });
    fs.writeFileSync(
        `${path.join(dirPath, ".git", "objects")}/${dir}/${fileName}`,
        compressedTree
    );
    console.log(`Created tree object at: .git/objects/${dir}/${fileName}`); // Debugging output
    return treeHash;
};

switch (command) {
    case "init":
        initializeGitDirectory();
        break;

    case "cat-file":
        const hash = process.argv[4];
        if (!hash) {
            console.error("Error: No hash provided for cat-file command.");
            process.exit(1);
        }
        if (param === "-p") displayObject(hash);
        break;

    case "hash-object":
        const file = process.argv[4];
        if (!file) {
            console.error("Error: No file provided for hash-object command.");
            process.exit(1);
        }
        if (param === "-w") computeHashObject(file);
        break;

    case "ls-tree":
        {
            const flag = process.argv[3];
            const treeSHA = process.argv[4];
            if (flag === "--name-only") {
                printObject(treeSHA);
            } else {
                throw new Error(`Unknown flag ${flag}`);
            }
            break;
        }

    case "write-tree":
        const treeHash = createTree(__dirname);
        process.stdout.write(treeHash);
        break;

    default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
}