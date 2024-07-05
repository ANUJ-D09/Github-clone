const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { createHash } = require("crypto");

const BASE_FOLDER_PATH = path.join(process.cwd(), '.git'); //git folder path base

//get the command and the flag from the input
const command = process.argv[2];
if (process.argv[3] && process.argv[3].startsWith('-')) { global.flag = process.argv[3]; } else { global.flag = '' }

switch (command) {
    case "init":
        createGitDirectory();
        break;
    case "cat-file":
        readBlob();
        break;
    case "hash-object":
        const hash = writeBlob();
        process.stdout.write(hash);
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
    case "write-tree":
        returnTreeHash();
        break;
    default:
        throw new Error(`Unknown command ${command}`);
}

function createGitDirectory() {
    fs.mkdirSync(BASE_FOLDER_PATH, { recursive: true });
    fs.mkdirSync(path.join(BASE_FOLDER_PATH, "objects"), { recursive: true });
    fs.mkdirSync(path.join(BASE_FOLDER_PATH, "refs"), { recursive: true });

    fs.writeFileSync(path.join(process.cwd(), ".git", "HEAD"), "ref: refs/heads/main\n");
    console.log("Initialized git directory");
}

function readBlob() {
    //Get the bolb sha from input
    const bolbSha = process.argv[4];

    //format the sha to the path format
    const shaFirst = bolbSha.match(/.{1,2}/g)[0];

    //read the file from the path specified
    const shaData = fs.readFileSync(path.join(process.cwd(), ".git", "objects", shaFirst, bolbSha.slice(2)));

    //unzip the sha-data
    let unzippedData = zlib.inflateSync(shaData);

    //may there is unzip algrithm used to compressed the data
    if (!unzippedData) unzippedData = zlib.unzipSync(shaData);
    unzippedData = unzippedData.toString();

    //after decompression bolb object format: blob <size>\0<content>
    unzippedData = unzippedData.split('\0')[1];

    //log out the data without the newline at the end
    process.stdout.write(unzippedData);
}

function writeBlob() {
    //get the file name from the input
    const fileName = process.argv[4];

    //read the data from the file
    const data = fs.readFileSync(fileName);

    //after compression file should look like --> blob 11\0hello world
    const shaData = `blob ${data.length}\0${data}`;

    //create a hash object to compute the sha hash of the file algorithm sha1
    const hash = createHash('sha1').update(shaData).digest('hex');

    // if flag is specified as w then write the file in to the folder
    if (flag === '-w') {
        //following code will create the directory
        fs.mkdirSync(path.join(BASE_FOLDER_PATH, 'objects', hash.slice(0, 2)), { recursive: true });

        //to write a file, file name should be hash.slice(2)
        fs.writeFileSync(
            path.join(BASE_FOLDER_PATH, 'objects', hash.slice(0, 2), hash.slice(2)),
            zlib.deflateSync(shaData)
        );
    }

    return hash;
}

function readTree() {
    if (flag === '--name-only') {
        // get the <tree_sha> from the input
        const treeSha = process.argv[4];

        // get the file path from that sha
        const compressedData = fs.readFileSync(path.join(BASE_FOLDER_PATH, 'objects', treeSha.slice(0, 2), treeSha.slice(2)));

        // decompress the file
        const decompressData = zlib.inflateSync(compressedData);

        // convert to string and extract the file names and modes correctly
        const entries = [];
        let i = 0;

        while (i < decompressData.length) {
            // mode and filename are separated by a space
            const spaceIndex = decompressData.indexOf(0x20, i); // 0x20 is the ASCII code for space
            const mode = decompressData.slice(i, spaceIndex).toString();

            // null character marks the end of the filename
            const nullIndex = decompressData.indexOf(0x00, spaceIndex); // 0x00 is the ASCII code for null
            const name = decompressData.slice(spaceIndex + 1, nullIndex).toString();

            // SHA1 hash is 20 bytes (40 hex characters) after the null character
            const sha1Hex = decompressData.slice(nullIndex + 1, nullIndex + 21).toString('hex');

            entries.push({ mode, name, sha1Hex });
            i = nullIndex + 21; // move to the next entry
        }

        // output only the names
        entries.forEach(entry => console.log(entry.name));
    }
}


function writeTree(currentPath = process.cwd()) {
    let workingDir = fs.readdirSync(currentPath).filter(item => item !== '.git');
    let treeObject = [];

    // Iterate over the files/directories in the working directory
    workingDir.forEach(content => {
        const entryPath = path.join(currentPath, content);
        const stat = fs.statSync(entryPath);

        // If the entry is a file, create a blob object and record its SHA hash
        if (stat.isFile()) {
            treeObject.push({
                mode: '100644',
                name: content,
                hash: writeBlob(process.argv[4] = entryPath, flag = '')
            });
        }
        // If the entry is a directory, recursively create a tree object and record its SHA hash
        else if (stat.isDirectory()) {
            treeObject.push({
                mode: '40000',
                name: content,
                hash: writeTree(entryPath)
            });
        }
    });

    // write the tree object to the .git/objects directory
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

function returnTreeHash() {
    const treeHash = writeTree();
    process.stdout.write(treeHash);
}

function prettyPrintObject(objectSHA) {
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
                    prettyPrintBlob(uncompressedData)
                    break
                case "tree":
                    prettyPrintTree(uncompressedData)
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

function prettyPrintBlob(uncompressedData) {
    const content = uncompressedData.split("\x00")[1]
    process.stdout.write(content)
}

function prettyPrintTree(uncompressedData) {
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