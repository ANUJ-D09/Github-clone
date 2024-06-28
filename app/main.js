const fs = require("fs");
const path = require("path");
const { stdout } = require("process");
const zlib = require("zlib");
const crypto = require("crypto");

// You can use print statements as follows for debugging, they'll be visible when running tests.
// console.log("Logs from your program will appear here!");

const command = process.argv[2];

switch (command) {
    case "init":
        createGitDirectory();
        break;
    case "cat-file":
        catFile();
        break;
    case "hash-object":
        hashObject();
        break;
    case "ls-tree":
        lsTree();
        break;
    case "write-tree":
        process.stdout.write(writeTree());
        break;
    case "commit-tree":
        commitTree(process.argv.slice(3));
        break;
    default:
        throw new Error(`Unknown command ${command}`);
}

function createGitDirectory() {
    // ./your_git.sh init
    fs.mkdirSync(path.join(__dirname, ".git"), { recursive: true });
    fs.mkdirSync(path.join(__dirname, ".git", "objects"), { recursive: true });
    fs.mkdirSync(path.join(__dirname, ".git", "refs"), { recursive: true });

    fs.writeFileSync(
        path.join(__dirname, ".git", "HEAD"),
        "ref: refs/heads/main\n"
    );
    console.log("Initialized git directory");
}

function catFile() {
    // ./your-git.sh cat-file -p <hash>
    const type = process.argv[3];
    const hash = process.argv[4];
    if (!type || !hash) {
        throw new Error("Missing arguments");
    }
    if (type !== "-p") {
        throw new Error(`Unknown flag ${type}`);
    }
    const file = fs.readFileSync(
        path.join(__dirname, ".git", "objects", hash.slice(0, 2), hash.slice(2))
    );
    const decompressed = zlib.inflateSync(file);
    const contentStart = decompressed.indexOf("\x00") + 1;
    const content = decompressed.toString("utf-8", contentStart);
    process.stdout.write(content);
}

function hashObject() {
    // .your-git.sh hash-object -w <file>
    const flag = process.argv[3];
    const file = process.argv[4];
    if (!flag || !file) {
        throw new Error("Missing arguments");
    }
    if (flag !== "-w") {
        throw new Error(`Unknown flag ${flag}`);
    }

    const hash = hashFile(file);
    process.stdout.write(hash);
}

function hashFile(file) {
    const content = fs.readFileSync(file);
    const header = `blob ${content.length}\x00`;
    const store = zlib.deflateSync(Buffer.from(header + content));
    const hash = crypto.createHash("sha1").update(store).digest("hex");
    const hashPath = path.join(__dirname, ".git", "objects", hash.slice(0, 2));
    fs.mkdirSync(hashPath, { recursive: true });
    fs.writeFileSync(path.join(hashPath, hash.slice(2)), store);
    return hash;
}

function lsTree() {
    // ./your-git.sh ls-tree [--name-only] <hash>
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

function writeTree(dir = __dirname) {
    // ./your-git.sh write-tree
    const tree = parseTree(dir);

    let contents = Buffer.alloc(0);
    tree.forEach(({ mode, hash, name }) => {
        contents = Buffer.concat([
            contents,
            Buffer.from(`${mode} ${name}\0`),
            Buffer.from(hash, "hex"),
        ]);
    });

    // store
    const store = Buffer.concat([
        Buffer.from(`tree ${contents.length}\0`),
        contents,
    ]);

    // create a hash of the tree
    const hash = crypto.createHash("sha1").update(store).digest("hex");

    // compress
    const compressed = zlib.deflateSync(store);

    // store the compressed tree
    const hashPath = path.join(__dirname, ".git", "objects", hash.slice(0, 2));
    fs.mkdirSync(hashPath, { recursive: true });
    fs.writeFileSync(path.join(hashPath, hash.slice(2)), compressed);

    return hash;
}

// get the directory and filename in the path
function parseTree(dirpath) {
    return fs
        .readdirSync(dirpath)
        .filter((subpath) => subpath !== ".git")
        .filter((subpath) => subpath !== "main.js")
        .map((subpath) => {
            const fullPath = path.join(dirpath, subpath);

            if (fs.lstatSync(fullPath).isDirectory()) {
                return {
                    mode: 40000,
                    name: subpath,
                    hash: writeTree(fullPath),
                };
            }

            return {
                mode: 100644,
                name: subpath,
                hash: hashFile(fullPath),
            };
        });
}

// parse the contents of a tree object
function parseContents(contents, acc = []) {
    if (contents.length === 0) {
        return acc;
    }

    const spaceIndex = contents.indexOf(" ");
    const nullIndex = contents.indexOf("\0");
    const hashIndex = nullIndex + 1 + 20;
    const mode = parseInt(contents.slice(0, spaceIndex).toString(), 8);
    const name = contents.slice(spaceIndex + 1, nullIndex).toString();
    const hash = contents.slice(nullIndex + 1, hashIndex).toString("hex");

    return parseContents(contents.slice(hashIndex), [
        ...acc,
        { mode, name, hash },
    ]);
}

function commitTree([message = "", _, parentCommitSha]) {
    // ./your_git.sh commit-tree -m <message> -p <commit_sha>

    const author = "Oreste Abizera <oresteabizera11@gmail.com>";
    const date = new Date();
    const timestamp = date.getTime();
    const timezone = date.getTimezoneOffset();

    const tree = writeTree(__dirname);

    const contents = Buffer.concat([
        Buffer.from(`tree ${tree}\n`, "utf-8"),
        Buffer.from(`parent ${parentCommitSha}\n`, "utf-8"),
        Buffer.from(`author ${author} ${timestamp} ${timezone}\n`, "utf-8"),
        Buffer.from(`committer ${author} ${timestamp} ${timezone}\n`, "utf-8"),
        Buffer.from("\n", "utf-8"),
        Buffer.from(message, "utf-8"),
        Buffer.from("\n", "utf-8"),
    ]);

    const commitData = Buffer.concat([
        Buffer.from(`commit ${contents.length}\0`),
        contents,
    ]);

    const hash = crypto.createHash("sha1").update(commitData).digest("hex");
    const [dir, filename] = [hash.slice(0, 2), hash.slice(2)];

    if (!fs.existsSync(path.join(__dirname, ".git", "objects", dir))) {
        fs.mkdirSync(path.join(__dirname, ".git", "objects", dir), {
            recursive: true,
        });
    }

    const pathToFile = path.join(__dirname, ".git", "objects", dir, filename);
    fs.writeFileSync(pathToFile, zlib.deflateSync(commitData));

    const mainPath = path.join(__dirname, ".git", "refs", "heads");
    if (!fs.existsSync(mainPath)) {
        fs.mkdirSync(mainPath, { recursive: true });
    }

    fs.writeFileSync(path.join(mainPath, "main"), zlib.deflateSync(hash + "\n"));

    process.stdout.write(hash + "\n");
}