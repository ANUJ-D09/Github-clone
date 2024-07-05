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
        const hash = writeBolb();
        process.stdout._write(hash);
        break;
    case "ls-tree":
        readTree();
        break;
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
    let unzipedData = zlib.inflateSync(shaData);

    //may there is unzip algrithm used to compressed the data
    if (!unzipedData) unzipedData = zlib.unzipSync(shaData);
    unzipedData = unzipedData.toString()

    //after decompression bolb object format: blob <size>\0<content>
    unzipedData = unzipedData.split('\0')[1];


    //log out the data without the newline at the end
    process.stdout._write(unzipedData);
}


function writeBolb() {
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
        let treeData = decompressData.toString();
        const entries = [];
        let i = 0;

        while (i < treeData.length) {
            // mode and filename are separated by a space
            const spaceIndex = treeData.indexOf(' ', i);
            const mode = treeData.substring(i, spaceIndex);

            // null character marks the end of the filename
            const nullIndex = treeData.indexOf('\0', spaceIndex);
            const name = treeData.substring(spaceIndex + 1, nullIndex);

            // SHA1 hash is 20 bytes (40 hex characters) after the null character
            const sha1Hex = Buffer.from(treeData.substring(nullIndex + 1, nullIndex + 21), 'binary').toString('hex');

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
        zlib.deflateSync(tree)
    );

    return treeHash;
}

function returnTreeHash() {
    const treeHash = writeTree();

    process.stdout._write(treeHash);
}