const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
// Uncomment this block to pass the first stage
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
    fs.mkdirSync(path.join(__dirname, '.git'), { recursive: true });
    fs.mkdirSync(path.join(__dirname, '.git', 'objects'), { recursive: true });
    fs.mkdirSync(path.join(__dirname, '.git', 'refs'), { recursive: true });
    fs.writeFileSync(
        path.join(__dirname, '.git', 'HEAD'),
        'ref: refs/heads/main\n'
    );
    console.log('Initialized git directory');
}

function createObject(flag, blobSha) {
    // check if the directory and file which denotes a file exists
    let dirName = blobSha.slice(0, 2);
    let fileName = blobSha.slice(2);
    let filePath = path.join(__dirname, '.git', 'objects', dirName, fileName);
    let fileExists = fs.existsSync(filePath);
    if (fileExists) {
        let fileContent = fs.readFileSync(filePath);
        if (flag === '-t') {
            // see the type of object
            const decompressedData = zlib.inflateSync(fileContent);
            const headerEndIndex = decompressedData.indexOf(0x00); // Find the null byte separator
            const objectType = decompressedData
                .slice(0, headerEndIndex)
                .toString('utf-8');
            process.stdout.write(objectType);
        } else if (flag === '-p') {
            // see the content of object
            // then print without new line
            let uncompressedContent = zlib.unzipSync(fileContent).toString();
            let [header, blobContent] = uncompressedContent.split('\0');
            process.stdout.write(blobContent);
        } else {
            throw new Error('Invalid flags: ', flag);
        }
    } else {
        throw new Error('SHA Object: ', blobSha, ' does not exists. ');
    }
}

function hashObject() {
    const writeCommand = process.argv[3];
    if (writeCommand !== '-w') return;
    // const inflated = zlib.inflateSync(file);
    const file = process.argv[4];
    const content = fs.readFileSync(file);
    const header = `blob ${content.length}\x00`;
    // const response = inflated.toString();
    const data = header + content;
    const hash = crypto.createHash('sha1').update(data).digest('hex');
    // const [type, content] = response.split("\x00");
    const objectsDirPath = path.join(__dirname, '.git', 'objects');
    const hashDirPath = path.join(objectsDirPath, hash.slice(0, 2));
    const filePath = path.join(hashDirPath, hash.slice(2));
    // process.stdout.write(content);
    fs.mkdirSync(hashDirPath, { recursive: true });
    fs.writeFileSync(filePath, zlib.deflateSync(data));
    process.stdout.write(hash);
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