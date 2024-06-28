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
        if (param === "-p") readObject(hash);
        break;
    case "hash-object":
        const file = process.argv[4];
        if (param === "-w") hashObject(file);
        break;
    case 'ls-tree':
        lsTree();
        break;
    default:
        throw new Error(`Unknown command ${command}`);
}

function lsTree() {
    const isNameOnly = process.argv[3];
    let hash = '';
    if (isNameOnly === '--name-only') {
        //display the name only
        hash = process.argv[4];
    } else {
        hash = process.argv[3];
    }
    const dirName = hash.slice(0, 2);
    const fileName = hash.slice(2);
    const objectPath = path.join(__dirname, '.git', 'objects', dirName, fileName);
    const dataFromFile = fs.readFileSync(objectPath);
    //decrypt the data from the file
    const inflated = zlib.inflateSync(dataFromFile);
    //notice before encrypting the data what we do was we encrypt
    //blob length/x00 so to get the previous string back what we need to do is split with /xoo
    const enteries = inflated.toString('utf-8').split('\x00');
    //enteries will be [blob length/x00, actual_file_content]
    const dataFromTree = enteries.slice(1);
    const names = dataFromTree
        .filter((line) => line.includes(' '))
        .map((line) => line.split(' ')[1]);
    const namesString = names.join('\n');
    const response = namesString.concat('\n');
    //this is the regex pattern that tells to replace multiple global \n with single \n
    process.stdout.write(response.replace(/\n\n/g, '\n'));
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