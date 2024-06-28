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
        createTree();
        break;
    default:
        throw new Error(`Unknown command ${command}`);
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

function createSHA() {
    const flag = process.argv[3];
    if (flag == "-w") {
        const file = process.argv[4];
        let fileContent = fs.readFileSync(file, 'utf-8');
        let header = "blob " + fileContent.length + "\0"
        let store = header + fileContent;
        let hash = crypto.createHash('sha1').update(store).digest('hex');

        const directory = hash.slice(0, 2);
        const fileName = hash.slice(2);
        const dirPath = path.join(__dirname, ".git", "objects", directory);
        const filePath = path.join(__dirname, ".git", "objects", directory, fileName);

        //NOTE: The recursive option in fs.mkdirSync() determines whether parent directories should be created if they do not exist.
        fs.mkdirSync(dirPath, { recursive: true });
        //or
        // fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, zlib.deflateSync(store));
        process.stdout.write(hash); //prints a 40-character SHA hash to stdout
    }
}

function getCatFile() {
    const flag = process.argv[3];
    switch (flag) {
        case "-p":
            let hash_val = process.argv[4];
            let objHashDir = hash_val.slice(0, 2);
            let blobFileName = hash_val.slice(2);
            const filePath = path.join(__dirname, ".git", "objects", objHashDir, blobFileName);
            if (fs.existsSync(filePath)) {
                let fileContent = fs.readFileSync(filePath);
                let uncompressedContent = zlib.unzipSync(fileContent).toString();
                let [header, blobContent] = uncompressedContent.split("\0");
                process.stdout.write(blobContent);
            } else {
                console.log("File does not exists!");
            }
            break;
        default:
            break;
    }
    const objectPath = path.join(__dirname, ".git", "objects");
}

function createGitDirectory() {
    fs.mkdirSync(path.join(__dirname, ".git"), { recursive: true });
    fs.mkdirSync(path.join(__dirname, ".git", "objects"), { recursive: true });
    fs.mkdirSync(path.join(__dirname, ".git", "refs"), { recursive: true });
    fs.writeFileSync(path.join(__dirname, ".git", "HEAD"), "ref: refs/heads/main\n");
    console.log("Initialized git directory");
}