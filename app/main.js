const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { createHash } = require("crypto");
const axios = require("axios");

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
    case "commit-tree":
        const treeSHA = process.argv[3];
        const parentCommitSHA = process.argv[5];
        const message = process.argv[7];
        const commitSHA = commitTree(treeSHA, parentCommitSHA, message);
        process.stdout.write(commitSHA);
        break;
    case "clone":
        {
            const repoUrl = process.argv[3];
            const targetDir = process.argv[4];
            cloneRepo(repoUrl, targetDir);
            break;
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

function commitTree(treeSHA, parentCommitSHA, message) {
    const author = "Your Name <you@example.com>";
    const timestamp = Math.floor(Date.now() / 1000);
    const commitData = [
        `tree ${treeSHA}`,
        `parent ${parentCommitSHA}`,
        `author ${author} ${timestamp} +0000`,
        `committer ${author} ${timestamp} +0000`,
        '',
        message,
        ''
    ].join('\n');

    const commit = Buffer.concat([
        Buffer.from(`commit ${commitData.length}\0`),
        Buffer.from(commitData)
    ]);

    const commitHash = createHash('sha1').update(commit).digest('hex');

    fs.mkdirSync(path.join(BASE_FOLDER_PATH, 'objects', commitHash.slice(0, 2)), { recursive: true });

    fs.writeFileSync(
        path.join(BASE_FOLDER_PATH, 'objects', commitHash.slice(0, 2), commitHash.slice(2)),
        zlib.deflateSync(commit)
    );

    return commitHash;
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
sync

function main() {
    const [, , command, repoUrl, targetDir] = process.argv;

    if (command !== 'clone' || !repoUrl || !targetDir) {
        console.error('Usage: your_git.sh clone <repository_url> <directory>');
        process.exit(1);
    }

    try {
        await cloneRepo(repoUrl, targetDir);
        console.log('Clone completed successfully.');
    } catch (error) {
        console.error('Error cloning repository:', error);
    }
}

async function cloneRepo(repoUrl, targetDir) {
    // Create the target directory
    fs.mkdirSync(targetDir, { recursive: true });
    process.chdir(targetDir);

    // Initialize the .git directory
    initializeGitDirectory();

    // Get the repository information
    const repoInfo = await getRepoInfo(repoUrl);
    const packFileData = await getPackFile(repoUrl, repoInfo);

    // Process the packfile data
    processPackFile(packFileData);
}

function initializeGitDirectory() {
    const gitDir = '.git';
    fs.mkdirSync(gitDir, { recursive: true });
    fs.mkdirSync(path.join(gitDir, 'objects'), { recursive: true });
    fs.mkdirSync(path.join(gitDir, 'refs'), { recursive: true });

    fs.writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main\n');
    console.log('Initialized git directory');
}

async function getRepoInfo(repoUrl) {
    const infoRefsUrl = `${repoUrl}/info/refs?service=git-upload-pack`;
    const response = await axios.get(infoRefsUrl, { responseType: 'text' });
    return response.data;
}

async function getPackFile(repoUrl, repoInfo) {
    const packUrl = `${repoUrl}/git-upload-pack`;
    const response = await axios.post(packUrl, repoInfo, {
        headers: {
            'Content-Type': 'application/x-git-upload-pack-request',
            'Accept': 'application/x-git-upload-pack-result'
        },
        responseType: 'arraybuffer'
    });
    return response.data;
}

function processPackFile(packFileData) {
    const inflatedData = zlib.inflateSync(packFileData);
    // Further processing to unpack the objects and write to the .git/objects directory
    // This part is complex and requires understanding of the Git packfile format
    console.log('Pack file data processed:', inflatedData);
}

main();