const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
import { createHash, hash } from "crypto";

const command = process.argv[2];
const param = process.argv[3];

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
            const flag = process.argv[3]
            const treeSHA = process.argv[4]
            if (flag === "--name-only") {
                printObject(treeSHA)
            } else {
                throw new Error(`Unknown flag ${flag}`)
            }
            break
        }
    case "write-tree":
        returnTreeHash();
        break;
    default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
}

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

function printObject(objectSHA) {
    const objectPath = path.join(
        process.cwd(),
        ".git",
        "objects",
        objectSHA.slice(0, 2),
        objectSHA.slice(2)
    )
    const objectContent = fs.readFileSync(objectPath, "base64")
    const compressedData = Buffer.from(objectContent, "base64")
    zlib.unzip(compressedData, (err, buffer) => {
        if (err) {
            console.error("Error uncompressing data:", err)
        } else {
            const uncompressedData = buffer.toString("utf-8")
            const objectType = uncompressedData.split(" ")[0]
            switch (objectType) {
                case "blob":
                    printBlob(uncompressedData)
                    break
                case "tree":
                    printTree(uncompressedData)
                    break
                case "commit":
                    console.log("commit")
                    break
                default:
                    console.log("Unknown object type:", objectType)
            }
        }
    })
}

function printBlob(uncompressedData) {
    const content = uncompressedData.split("\x00")[1]
    process.stdout.write(content)
}

function printTree(uncompressedData) {
    const entries = uncompressedData.split("\x00")
        // Removing the header
    entries.shift()
        // Removing the last SHA
    entries.pop()
        // console.log(entries)
    for (const entry of entries) {
        const path = entry.split(" ")[1]
        path && console.log(path)
    }
}

function writeTree(currentPath = process.cwd()) {
    let workingDir = fs.readdirSync(currentPath).filter(item => item !== '.git');
    let treeObject = [];
    //Iterate over the files/directories in the working directory
    workingDir.forEach(content => {
        const entryPath = path.join(currentPath, content);
        const stat = fs.statSync(entryPath);
        //If the entry is a file, create a blob object and record its SHA hash
        if (stat.isFile()) {
            //writeBolb(process.argv[4] = content, flag = '-w');
            treeObject.push({
                mode: '100644',
                name: content,
                hash: writeBolb(process.argv[4] = entryPath, flag = '')
            })
        }

        //If the entry is a directory, recursively create a tree object and record its SHA hash
        else if (stat.isDirectory()) {

            treeObject.push({
                mode: '40000',
                name: content,
                hash: writeTree(entryPath)
            })
        }

    });
    //write the tree object to the .git/objects directory
    const treeData = treeObject.reduce((acc, { mode, name, hash }) => {
        return Buffer.concat([
            acc,
            Buffer.from(`${mode} ${name}\0`),
            Buffer.from(hash, 'hex'),
        ]);
    }, Buffer.alloc(0));

    const tree = Buffer.concat([
        Buffer.from(`tree ${treeData.length}\0`),
        treeData,
    ]);


    const treeHash = createHash('sha1').update(tree).digest('hex');

    fs.mkdirSync(path.join(BASE_FOLDER_PATH, 'objects', treeHash.slice(0, 2)), { recursive: true });
    fs.writeFileSync(
        path.join(BASE_FOLDER_PATH, 'objects', treeHash.slice(0, 2), treeHash.slice(2)),
        zlip.deflateSync(tree)
    );

    return treeHash;
}

function returnTreeHash() {
    const treeHash = writeTree();
    process.stdout._write(treeHash);
}