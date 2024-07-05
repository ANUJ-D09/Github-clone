const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { createHash } = require("crypto");

const BASE_FOLDER_PATH = path.join(process.cwd(), '.git'); // Base Git folder path

// Get the command and the flag from the input
const command = process.argv[2];
if (process.argv[3] && process.argv[3].startsWith('-')) {
    global.flag = process.argv[3];
} else {
    global.flag = '';
}

switch (command) {
    case "init":
        initializeGitDirectory();
        break;
    case "cat-file":
        readBlobObject();
        break;
    case "hash-object":
        const hash = writeBlobObject();
        process.stdout.write(hash);
        break;
    case "ls-tree":
        {
            const flag = process.argv[3];
            const treeSHA = process.argv[4];
            if (flag === "--name-only") {
                printTreeObject(treeSHA);
            } else {
                throw new Error(`Unknown flag ${flag}`);
            }
            break;
        }
    case "write-tree":
        returnTreeObjectHash();
        break;
        'commit-tree' () => {
            const treeSHA = process.argv[3];
            const parentCommitSHA = process.argv.slice(process.argv.indexOf('-p'), process.argv.indexOf('-p') + 2)[1];
            const message = process.argv.slice(process.argv.indexOf('-m'), process.argv.indexOf('-m') + 2)[1];
            const commitContentBuffer = Buffer.concat([
                Buffer.from(`tree ${treeSHA}\n`),
                Buffer.from(`parent ${parentCommitSHA}\n`),
                Buffer.from(`author The Commiter <thecommitter@test.com> ${Date.now} +0000\n`),
                Buffer.from(`commiter The Commiter <thecommitter@test.com> ${Date.now} +0000\n\n`),
                Buffer.from(`${message}\n`)
            ]);
            const commitBuffer = Buffer.concat([
                Buffer.from(`commit ${commitContentBuffer.length}\0`),
                commitContentBuffer
            ]);
            const commitHash = generateHash(commitBuffer);
            const compressedCommit = zlib.deflateSync(commitBuffer);

            const dir = commitHash.slice(0, 2);
            const fileName = commitHash.slice(2);
            const commitDir = path.resolve(__dirname, '.git', 'objects', dir);

            mkdirSync(commitDir, { recursive: true });
            writeFileSync(path.resolve(commitDir, fileName), compressedCommit);

            process.stdout.write(commitHash);
        }

    default:
        throw new Error(`Unknown command ${command}`);
}

function initializeGitDirectory() {
    fs.mkdirSync(BASE_FOLDER_PATH, { recursive: true });
    fs.mkdirSync(path.join(BASE_FOLDER_PATH, "objects"), { recursive: true });
    fs.mkdirSync(path.join(BASE_FOLDER_PATH, "refs"), { recursive: true });

    fs.writeFileSync(path.join(process.cwd(), ".git", "HEAD"), "ref: refs/heads/main\n");
    console.log("Initialized git directory");
}

function readBlobObject() {
    const blobSha = process.argv[4];

    const shaFirst = blobSha.match(/.{1,2}/g)[0];

    const shaData = fs.readFileSync(path.join(process.cwd(), ".git", "objects", shaFirst, blobSha.slice(2)));

    let unzippedData = zlib.inflateSync(shaData);

    if (!unzippedData) unzippedData = zlib.unzipSync(shaData);
    unzippedData = unzippedData.toString();

    unzippedData = unzippedData.split('\0')[1];

    process.stdout.write(unzippedData);
}

function writeBlobObject() {
    const fileName = process.argv[4];

    const data = fs.readFileSync(fileName);

    const shaData = `blob ${data.length}\0${data}`;

    const hash = createHash('sha1').update(shaData).digest('hex');

    if (flag === '-w') {
        fs.mkdirSync(path.join(BASE_FOLDER_PATH, 'objects', hash.slice(0, 2)), { recursive: true });

        fs.writeFileSync(
            path.join(BASE_FOLDER_PATH, 'objects', hash.slice(0, 2), hash.slice(2)),
            zlib.deflateSync(shaData)
        );
    }

    return hash;
}

function readTreeObject() {
    if (flag === '--name-only') {
        const treeSha = process.argv[4];

        const compressedData = fs.readFileSync(path.join(BASE_FOLDER_PATH, 'objects', treeSha.slice(0, 2), treeSha.slice(2)));

        const decompressedData = zlib.inflateSync(compressedData);

        const entries = [];
        let i = 0;

        while (i < decompressedData.length) {
            const spaceIndex = decompressedData.indexOf(0x20, i);
            const mode = decompressedData.slice(i, spaceIndex).toString();

            const nullIndex = decompressedData.indexOf(0x00, spaceIndex);
            const name = decompressedData.slice(spaceIndex + 1, nullIndex).toString();

            const sha1Hex = decompressedData.slice(nullIndex + 1, nullIndex + 21).toString('hex');

            entries.push({ mode, name, sha1Hex });
            i = nullIndex + 21;
        }

        entries.forEach(entry => console.log(entry.name));
    }
}

function writeTreeObject(currentPath = process.cwd()) {
    let workingDir = fs.readdirSync(currentPath).filter(item => item !== '.git');
    let treeObject = [];

    workingDir.forEach(content => {
        const entryPath = path.join(currentPath, content);
        const stat = fs.statSync(entryPath);

        if (stat.isFile()) {
            treeObject.push({
                mode: '100644',
                name: content,
                hash: writeBlobObject(process.argv[4] = entryPath, flag = '')
            });
        } else if (stat.isDirectory()) {
            treeObject.push({
                mode: '40000',
                name: content,
                hash: writeTreeObject(entryPath)
            });
        }
    });

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
        zlib.deflateSync(tree)
    );

    return treeHash;
}

function returnTreeObjectHash() {
    const treeHash = writeTreeObject();
    process.stdout.write(treeHash);
}

function printTreeObject(objectSHA) {
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
                    printBlobObject(uncompressedData);
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

function printBlobObject(uncompressedData) {
    const content = uncompressedData.split("\x00")[1];
    process.stdout.write(content);
}

function printTree(uncompressedData) {
    const entries = uncompressedData.split("\x00");
    entries.shift();
    entries.pop();
    for (const entry of entries) {
        const path = entry.split(" ")[1];
        path && console.log(path);
    }
}