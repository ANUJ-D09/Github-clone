const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function initGitDirectory() {
    const gitDir = path.join(process.cwd(), ".git");
    const objectsDir = path.join(gitDir, "objects");
    const refsDir = path.join(gitDir, "refs");

    try {
        fs.mkdirSync(gitDir);
        fs.mkdirSync(objectsDir);
        fs.mkdirSync(refsDir);
        fs.writeFileSync(path.join(gitDir, "HEAD"), "ref: refs/heads/main\n");
        console.log("Initialized git directory");
    } catch (err) {
        console.error("Error initializing git directory:", err);
    }
}

function getObjectFilePath(sha) {
    const objectDir = path.join(process.cwd(), ".git", "objects");
    const subdir = sha.slice(0, 2);
    const filename = sha.slice(2);
    return path.join(objectDir, subdir, filename);
}

function lsTree(treeSha, nameOnly) {
    try {
        const objectFilePath = getObjectFilePath(treeSha);

        if (!fs.existsSync(objectFilePath)) {
            throw new Error(`Object file not found: ${objectFilePath}`);
        }

        const fileContent = fs.readFileSync(objectFilePath);
        const inflated = zlib.inflateSync(fileContent);
        const content = inflated.toString();

        let entries = content.split("\0");
        entries = entries.filter(entry => entry.length > 0); // Remove empty entries

        if (nameOnly) {
            entries = entries.map(entry => {
                const [metadata, name, sha] = entry.split(" ");
                return name;
            });
        } else {
            entries = entries.map(entry => {
                const [metadata, name, sha] = entry.split(" ");
                return `${metadata} ${sha}\t${name}`;
            });
        }

        entries.sort(); // Sort entries alphabetically

        entries.forEach(entry => console.log(entry));
    } catch (err) {
        console.error("Error listing tree:", err);
    }
}

// Command line argument handling
const command = process.argv[2];
const param = process.argv[3];

switch (command) {
    case "init":
        initGitDirectory();
        break;
    case "ls-tree":
        const treeSha = param;
        const nameOnly = process.argv.includes("--name-only");
        lsTree(treeSha, nameOnly);
        break;
    default:
        console.error(`Unknown command ${command}`);
}