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
        {
            const flag = process.argv[3]
            const treeSHA = process.argv[4]
            if (flag === "--name-only") {
                prettyPrintObject(treeSHA)
            } else {
                throw new Error(`Unknown flag ${flag}`)
            }
            break
        }

    default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
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

function prettyPrintObject(objectSHA) {
    const objectPath = path.join(
        process.cwd(),
        ".git",
        "objects",
        objectSHA.slice(0, 2),
        objectSHA.slice(2)
    );

    const objectContent = fs.readFileSync(objectPath);
    zlib.inflate(objectContent, (err, buffer) => {
        if (err) {
            console.error("Error uncompressing data:", err);
        } else {
            const uncompressedData = buffer.toString("utf-8");
            const content = uncompressedData.split("\x00")[1];
            process.stdout.write(content + '\n');
            const objectType = uncompressedData.split(" ")[0];
            switch (objectType) {
                case "blob":
                    prettyPrintBlob(content);
                    break;
                case "tree":
                    prettyPrintTree(uncompressedData);
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

function prettyPrintBlob(content) {
    process.stdout.write(content + '\n');
}

function prettyPrintTree(uncompressedData) {
    const entries = uncompressedData.split("\x00");
    // Removing the header
    entries.shift();
    // Removing the last SHA
    entries.pop();
    for (const entry of entries) {
        const parts = entry.split(" ");
        const path = parts[parts.length - 1];
        path && console.log(path);
    }
}