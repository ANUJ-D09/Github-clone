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
    case "ls-tree":
        lsTree(process.argv.slice(3));
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

function lsTree([_flag, hash]) {
    // get the directory and filename from the hash
    const [dirname, filename] = [hash.slice(0, 2), hash.slice(2)];
    // read the file
    const compressed = fs.readFileSync(path.join(__dirname, ".git", "objects", dirname, filename));
    // decompress
    const decompressed = zlib.unzipSync(compressed);
    // header
    // console.log(decompressed.subarray(0, decompressed.indexOf("\0")).toString());
    // contents
    const contents = decompressed.subarray(decompressed.indexOf("\0") + 1);
    process.stdout.write(
        parseContents(contents, [])
        .map(({ name }) => name + "\n")
        .join("")
    );
    // [mode] [file/folder name]\0[SHA-1 of referencing blob or tree]
    function parseContents(contents, result = []) {
        if (contents.length === 0) return result;
        const white_index = contents.indexOf(" ");
        const null_index = contents.indexOf("\0");
        const hash_index = null_index + 1 + 20;
        return parseContents(contents.subarray(hash_index + 1), [
            ...result,
            {
                // mode
                mode: contents.subarray(0, white_index).toString(),
                // file/folder name
                name: contents.subarray(white_index + 1, null_index).toString(),
                // SHA-1 of referencing blob or tree
                hash: contents.subarray(null_index + 1, hash_index).toString("hex"),
            },
        ]);
    }
}