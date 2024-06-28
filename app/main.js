const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const command = process.argv[2];
switch (command) {
    case 'init':
        createGitDirectory();
        break;
    case 'cat-file':
        const flag = process.argv[3]; // -p or -t
        const blobSha = process.argv[4];
        createObject(flag, blobSha);
        break;
    case 'hash-object':
        hashObject();
        break;
    case 'ls-tree':
        lsTree();
        break;
    default:
        throw new Error(`Unknown command ${command}`);
}

function createGitDirectory() {
    const gitDirPath = path.join(__dirname, '.git');
    const objectsDirPath = path.join(gitDirPath, 'objects');
    const refsDirPath = path.join(gitDirPath, 'refs');
    const headFilePath = path.join(gitDirPath, 'HEAD');

    try {
        fs.mkdirSync(gitDirPath, { recursive: true });
        fs.mkdirSync(objectsDirPath, { recursive: true });
        fs.mkdirSync(refsDirPath, { recursive: true });
        fs.writeFileSync(headFilePath, 'ref: refs/heads/main\n');
        console.log('Initialized git directory at', gitDirPath);
    } catch (error) {
        console.error('Failed to initialize git directory:', error);
    }
}

function createObject(flag, blobSha) {
    const dirName = blobSha.slice(0, 2);
    const fileName = blobSha.slice(2);
    const filePath = path.join(__dirname, '.git', 'objects', dirName, fileName);

    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath);
        if (flag === '-t') {
            const decompressedData = zlib.inflateSync(fileContent);
            const headerEndIndex = decompressedData.indexOf(0x00); // Find the null byte separator
            const objectType = decompressedData.slice(0, headerEndIndex).toString('utf-8');
            process.stdout.write(objectType);
        } else if (flag === '-p') {
            const uncompressedContent = zlib.unzipSync(fileContent).toString();
            const [header, blobContent] = uncompressedContent.split('\0');
            process.stdout.write(blobContent);
        } else {
            throw new Error('Invalid flag:', flag);
        }
    } else {
        throw new Error('SHA Object:', blobSha, 'does not exist.');
    }
}

function hashObject() {
    const writeCommand = process.argv[3];
    if (writeCommand !== '-w') return;
    const file = process.argv[4];
    const content = fs.readFileSync(file);
    const header = `blob ${content.length}\x00`;
    const data = header + content;
    const hash = crypto.createHash('sha1').update(data).digest('hex');

    const objectsDirPath = path.join(__dirname, '.git', 'objects');
    const hashDirPath = path.join(objectsDirPath, hash.slice(0, 2));
    const filePath = path.join(hashDirPath, hash.slice(2));

    fs.mkdirSync(hashDirPath, { recursive: true });
    fs.writeFileSync(filePath, zlib.deflateSync(data));
    process.stdout.write(hash);
}

function lsTree() {
    const isNameOnly = process.argv[3] === '--name-only';
    const hash = isNameOnly ? process.argv[4] : process.argv[3];

    const dirName = hash.slice(0, 2);
    const fileName = hash.slice(2);
    const objectPath = path.join(__dirname, '.git', 'objects', dirName, fileName);

    const dataFromFile = fs.readFileSync(objectPath);
    const inflated = zlib.inflateSync(dataFromFile);
    const entries = inflated.toString('utf-8').split('\x00');
    const dataFromTree = entries.slice(1);
    const names = dataFromTree
        .filter(line => line.includes(' '))
        .map(line => line.split(' ')[1]);

    const namesString = names.join('\n');
    const response = namesString.concat('\n');
    process.stdout.write(response.replace(/\n\n/g, '\n'));
}