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
        hashObject();
        break;
    case "ls-tree":
        lsTree();
        break;


    case "write-tree":
        process.stdout.write(writeTree());
        break;
    default:
        throw new Error(`Unknown command ${command}`);
}

function createGitDirectory() {
    fs.mkdirSync(path.join(__dirname, ".git"), { recursive: true });
    fs.mkdirSync(path.join(__dirname, ".git", "objects"), { recursive: true });
    fs.mkdirSync(path.join(__dirname, ".git", "refs"), { recursive: true });
    fs.writeFileSync(path.join(__dirname, ".git", "HEAD"), "ref: refs/heads/main\n");
    console.log("Initialized git directory");
}

function getCatFile() {
    const type = process.argv[3];
    switch (type) {
        case "-p":
            const object = process.argv[4];
            const folder = object.substring(0, 2);
            const file = object.substring(2);
            const contents = fs.readFileSync(path.join(__dirname, ".git/objects", folder, file));
            const decompress = zlib.inflateSync(contents);
            const content = decompress.toString('utf-8').split('\0')[1];
            process.stdout.write(content);
            break;
    }
}

function hashObject() {
    if (process.argv[3] !== "-w") return;
    const file = process.argv[4];
    const content = fs.readFileSync(file);
    const header = `blob ${content.length}\x00`; //the reason for 00 is hexadec
    const data = header + content;
    const hash = crypto.createHash('sha1').update(data).digest('hex');
    const objectsDirPath = path.join(__dirname, ".git", "objects");
    const hashDirPath = path.join(objectsDirPath, hash.slice(0, 2));
    const filePath = path.join(hashDirPath, hash.slice(2));
    fs.mkdirSync(hashDirPath, { recursive: true });
    fs.writeFileSync(filePath, zlib.deflateSync(data));
    process.stdout.write(hash);
}

function lsTree() {
    if (process.argv[3] !== "--name-only") {
        throw new Error("Only --name-only flag is supported for now");
    }
    const hash = process.argv[4];

    //reading dir from hash
    const [folder, file] = [hash.slice(0, 2), hash.slice(2)];
    const objPath = path.join(__dirname, ".git", "objects", folder, file);
    const compressedContents = fs.readFileSync(objPath);
    const deflate = zlib.inflateSync(compressedContents).toString();
    const contents = deflate.split('\0').slice(1).map((line) => line.split(" ").slice(1).join(" "));
    process.stdout.write(contents.join("\n"));
}

function writeTree(dir = __dirname) {
    const filesAndDirs = fs
        .readdirSync(dir)
        .filter((f) => f !== ".git" && f !== "main.js");
    const entries = [];
    for (const file of filesAndDirs) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isFile()) {
            entries.push({
                mode: 100644,
                name: file,
                hash: writeBlob(fullPath),
            });
        } else {
            entries.push({
                mode: 40000,
                name: file,
                hash: writeTree(path.join(dir, file)),
            });
        }
    }
    const treeData = entries
        .map((e) => `${e.mode} ${e.name}\x00${Buffer.from(e.hash, "hex")}`)
        .join("");
    const contents = entries.reduce((acc, { mode, name, hash }) => {
        return Buffer.concat([
            acc,
            Buffer.from(`${mode} ${name}\0`),
            Buffer.from(hash, "hex"),
        ]);
    }, Buffer.alloc(0));
    const treeContents = Buffer.concat([
        Buffer.from(`tree ${contents.length}\x00`),
        contents,
    ]);
    const treeHash = hashContent(treeContents);
    fs.mkdirSync(path.join(__dirname, ".git", "objects", treeHash.slice(0, 2)), {
        recursive: true,
    });
    fs.writeFileSync(
        path.join(
            __dirname,
            ".git",
            "objects",
            treeHash.slice(0, 2),
            treeHash.slice(2)
        ),
        zlib.deflateSync(treeContents)
    );
    return treeHash;

}

function hashContent(data) {
    return crypto.createHash("sha1").update(data).digest("hex");
}

function writeBlob(file) {
    const fileContent = fs.readFileSync(file, "utf-8");
    const blob = `blob ${fileContent.length}\x00${fileContent}`;
    const hash = crypto.createHash("sha1").update(blob).digest("hex");
    const directory = hash.slice(0, 2);
    const filename = hash.slice(2);
    fs.mkdirSync(path.join(__dirname, ".git", "objects", directory), {
        recursive: true,
    });
    fs.writeFileSync(
        path.join(__dirname, ".git", "objects", directory, filename),
        zlib.deflateSync(blob)
    );
    return hash;
}