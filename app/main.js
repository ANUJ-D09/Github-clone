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
        lsTree();
        break;
    default:
        throw new Error(`Unknown command ${command}`);
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

function hashObject(file) {
    const fileContent = fs.readFileSync(path.join(process.cwd(), file));
    const header = `blob ${fileContent.length}\0`;
    const content = Buffer.concat([Buffer.from(header), fileContent]);
    const hash = crypto.createHash("sha1").update(content).digest("hex");
    const dir = path.join(process.cwd(), ".git", "objects", hash.slice(0, 2));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const compressed = zlib.deflateSync(content);
    fs.writeFileSync(path.join(dir, hash.slice(2)), compressed);
    process.stdout.write(hash);
}

function lsTree() {

    const isNameOnly = process.argv[3] === "--name-only";
    const hash = process.argv[isNameOnly ? 4 : 3];
    if (!hash) {
        throw new Error("Missing arguments");
    }
    const dirName = hash.slice(0, 2);
    const fileName = hash.slice(2);
    const objectPath = path.join(__dirname, ".git", "objects", dirName, fileName);
    const dataFromFile = fs.readFileSync(objectPath);
    const decompressed = zlib.inflateSync(dataFromFile);
    const contents = decompressed.subarray(decompressed.indexOf("\0") + 1);

    process.stdout.write(
        parseContents(contents, [])
        .map(({ mode, name }) => {
            return isNameOnly ? name : `${mode} ${name}`;
        })
        .join("\n")
        .concat("\n")
    );
}