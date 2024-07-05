const zlib = require("node:zlib");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const writeBlob = require("./writeBlob");
const parseTree = require("./parseGitTree");
const checkout = require("./checkout");
const init = require("./init");

process.removeAllListeners("warning"); // remove deprecation warnings

const {
    sha1,
    writeGitObject,
    readGitObject,
    parseGitObject,
    parseGitObjects,
    logObjectHashes,
    createTreeContent,
    parseTreeEntries,
    createBlobContent,
    createCommitContent,
} = require("./utils");
const { Hash } = require("node:crypto");

//clone("https://github.com/codecrafters-io/git-sample-2", "test");

async function clone(url, directory) {
    const gitDir = path.resolve(directory);
    fs.mkdirSync(gitDir);
    init(directory);

    const { gitObjects, deltaObjects, checkSum, head } =
    await getParsedGitObjects(url);

    //console.log(`THIS IS HEAD ${head.hash.toString("hex")}`);
    //if (gitObjects[head.hash.toString("hex")]) {
    //  console.log(
    //    "FOUND HEAD ",
    //    gitObjects[head.hash.toString("hex")].parsed.toString(),
    //  );
    //} else {
    //  console.log("HEAD NOT PRESNT");
    //}

    //for (let key in deltaObjects) {
    //  if (gitObjects[key]) {
    //    console.log(
    //      "FOUND REF OF DELTA ",
    //      deltaObjects[key].ref.toString("hex"),
    //      gitObjects[key],
    //    );
    //  } else {
    //    console.log(
    //      "DID NOT FIND REF OF DELTA ",
    //      deltaObjects[key].ref.toString("hex"),
    //    );
    //  }
    //}

    fs.writeFileSync(
        path.join(gitDir, ".git", "HEAD"),
        `ref: ${head.ref.toString("utf8")}`,
    );

    fs.mkdirSync(path.join(gitDir, ".git", "refs", "heads"), { recursive: true });
    fs.writeFileSync(
        path.join(gitDir, ".git", "refs", "heads", head.ref.split("/")[2]),
        head.hash,
    );

    for (let key in gitObjects) {
        let obj = gitObjects[key];
        writeGitObject(obj.hash, obj.parsed, gitDir);
    }

    let resolvedDeltas = resolveDeltaObjects(deltaObjects, gitDir);

    for (let key in resolvedDeltas) {
        let obj = resolvedDeltas[key];
        gitObjects[obj.hash] = obj;
    }

    let hashToCheckout = findTreeToCheckout(head.hash, gitDir);
    //console.log(hashToCheckout, gitObjects[hashToCheckout]);
    checkout(hashToCheckout, gitDir, gitDir);
    //console.log(gitObjects[head.hash].parsed.toString());
    //process.stdout.write(hashToCheckout);
    //fs.rmSync(gitDir, { recursive: true });
}

function findTreeToCheckout(hash, basePath = "") {
    const { type, length, content } = readGitObject(hash, basePath);

    if (type !== "commit") {
        throw new Error("Not a commit");
    }

    let commit = content.slice(content.indexOf("\0"));
    commit = content.toString().split("\n");
    let treeToCheckout = commit[0].split(" ")[1];
    return treeToCheckout;
}

async function getParsedGitObjects(url) {
    const { objects, checkSum, head } = await getRawGitObjects(url);
    const gitObjects = parseGitObjects(objects);
    const deltaObjects = {};
    objects.forEach((obj) => {
        if (obj.type === "delta") deltaObjects[obj.ref.toString("hex")] = obj;
    });
    return { gitObjects, deltaObjects, checkSum, head };
}

async function getRawGitObjects(url) {
    const { data, head } = await getPackFile(url);
    const packFile = data;
    const packObjects = packFile.slice(20);
    const packObjectCount = Buffer.from(packFile.slice(16, 20)).readUInt32BE(0);
    let i = 0;
    const objects = [];
    for (let count = 0; count < packObjectCount; count++) {
        const [byteRead, obj] = await parsePackObject(packObjects, i);
        i += byteRead;
        objects.push(obj);
    }
    // console.log(`FOUND ${entries} ENTRIES`);
    // console.log(`THERE ARE ${objs.length} OBJECTS DECODED`);
    const checkSum = packObjects.slice(packObjects.length - 20).toString("hex");
    i += 20;
    //console.log(`BYTES READ: ${offset}, BYTES RECEIVED: ${packObjects.length}`);
    return { objects, checkSum, head };
}

async function getPackFile(url) {
    const { packHash, ref } = await getPackFileHash(url);
    const packRes = await getPackFileFromServer(url, packHash);
    return { data: packRes.data, head: { ref, hash: packHash } };
}

async function getPackFileHash(url) {
    const gitPackUrl = "/info/refs?service=git-upload-pack";
    const response = await axios.get(url + gitPackUrl);
    const data = response.data;
    let hash = "";
    let ref = "";
    for (const line of data.split("\n")) {
        if (
            (line.includes("refs/heads/master") ||
                line.includes("refs/heads/main")) &&
            line.includes("003")
        ) {
            const head = line.split(" ");
            hash = head[0].substring(4);
            ref = head[1].trim();
            break;
        }
    }
    return { packHash: hash, ref };
}

async function getPackFileFromServer(url, hash) {
    const gitPackPostUrl = "/git-upload-pack";
    const hashToSend = Buffer.from(`0032want ${hash}\n00000009done\n`, "utf8");
    const headers = {
        "Content-Type": "application/x-git-upload-pack-request",
        "accept-encoding": "gzip,deflate",
    };
    const response = await axios.post(url + gitPackPostUrl, hashToSend, {
        headers,
        responseType: "arraybuffer", // Keep everything as buffer
    });
    return response;
}

async function parsePackObject(buffer, i) {
    const TYPE_CODES = {
        1: "commit",
        2: "tree",
        3: "blob",
        7: "delta",
    };
    let [parsedBytes, type, size] = parsePackObjectHeader(buffer, i);
    i += parsedBytes;
    // console.log(`Parsed ${parsed_bytes} bytes found type ${type} and size ${size}`,);
    // console.log(`Object starting at ${i} ${buffer[i]}`);
    if (type < 7 && type != 5) {
        const [gzip, used] = await decompressPackObject(buffer.slice(i), size);
        return [parsedBytes + used, { content: gzip, type: TYPE_CODES[type] }];
    } else if (type == 7) {
        const ref = buffer.slice(i, i + 20);
        parsedBytes += 20;
        const [gzip, used] = await decompressPackObject(buffer.slice(i + 20), size);
        return [parsedBytes + used, { content: gzip, type: TYPE_CODES[type], ref }];
    }
}

function parsePackObjectHeader(buffer, i) {
    let cur = i;
    const type = (buffer[cur] & 112) >> 4;
    let size = buffer[cur] & 15; // 00001111
    let offset = 4;
    while (buffer[cur] >= 128) {
        cur++;
        size += (buffer[cur] & 127) << offset;
        offset += 7;
    }
    return [cur - i + 1, type, size];
}

async function decompressPackObject(buffer, size) {
    try {
        const [data, used] = await inflateWithLengthLimit(buffer, size);
        return [data, used];
    } catch (err) {
        throw err;
    }
}

function inflateWithLengthLimit(compressedData, maxOutputSize) {
    return new Promise((resolve, reject) => {
        const inflater = new zlib.createInflate();
        let decompressedData = Buffer.alloc(0);
        let parsedBytes = 0;

        inflater.on("data", (chunk) => {
            decompressedData = Buffer.concat([decompressedData, chunk]);
            if (decompressedData.length > maxOutputSize) {
                inflater.emit(
                    "error",
                    new Error("Decompressed data exceeds maximum output size"),
                );
            }
        });

        inflater.on("end", () => {
            parsedBytes = inflater.bytesRead;
            resolve([decompressedData, parsedBytes]);
        });

        inflater.on("error", (err) => {
            reject(err);
        });

        inflater.write(compressedData);
        inflater.end();
    });
}

function resolveDeltaObjects(deltas, basePath = "") {
    let results = {};
    let pending = {};
    for (let key in deltas) {
        try {
            let delta = deltas[key];
            let hash = delta.ref.toString("hex");
            let instructions = delta.content;
            const { type, length, content } = readGitObject(hash, basePath);
            let decoded = { type: type, content: decodeDelta(instructions, content) };
            decoded = parseGitObject(decoded);
            writeGitObject(decoded.hash, decoded.parsed, basePath);
            //console.log(decoded, "THIS IS CONTENT");
        } catch (err) {
            pending[deltas[key].hash] = deltas[key];
        }
    }

    if (pending.length > 0) {
        resolveDeltaObjects(pending, basePath);
    }

    return results;
}

function decodeDelta(instructions, refContent) {
    refContent = Buffer.from(refContent, "utf8");
    content = Buffer.alloc(0);
    let i = 0;

    let { parsedBytes: refParsedBytes, size: refSize } = parseSize(
        instructions,
        i,
    );
    //console.log("-----------------------------------");
    //console.log("PARSED REF SIZE AT OFFSET ", i, " FOUND SIZE ", refSize);
    i += refParsedBytes;

    let { parsedBytes: targetParsedBytes, size: targetSize } = parseSize(
        instructions,
        i,
    );
    //console.log("PARSED TARGET SIZE AT OFFSET ", i, " FOUND SIZE ", targetSize);
    //console.log("-----------------------------------");
    i += targetParsedBytes;
    //console.log("\n");
    //console.log("PARSING INSTRUCTIONS: ");
    //console.log("-----------------------------------");
    while (i < instructions.length) {
        if (instructions[i] <= 127) {
            let { parsedBytes, insertContent } = parseInsert(instructions, i);
            content = Buffer.concat([content, insertContent]);
            i += parsedBytes;
            //console.log(
            //  "     AT OFFSET: ",
            //  i,
            //  "INSERTING: ",
            //  insertContent.length,
            //  "BYTES FROM INSTRUCTIONS",
            //);
            //console.log("     CONTENT: ", insertContent.toString());
            //console.log("-----------------------------------");
        } else if (instructions[i] > 127 && instructions[i] < 256) {
            let { parsedBytes, offset, size } = parseCopy(instructions, i);
            let copyContent = refContent.slice(offset, offset + size);
            content = Buffer.concat([content, copyContent]);
            i += parsedBytes;
            //console.log(
            //  "     AT OFFSET: ",
            //  i,
            //  "COPYING:",
            //  size,
            //  "BYTES FROM REF",
            //  "AT OFFSET: ",
            //  offset,
            //);
            //console.log("     CONTENT: ", copyContent.toString());
            //console.log("-----------------------------------");
        } else {
            throw new Error("Not copy or insert");
        }
    }
    //console.log("PARSED: ", i, "RECEIVED: ", instructions.length);
    //console.log("\n");
    if (targetSize == content.length) {
        return content;
    } else {
        throw new Error("Wrong target size, error in decoding delta");
    }
}

function parseInsert(data, i) {
    const size = data[i];
    let parsedBytes = 1;
    i += parsedBytes;
    const insertContent = data.slice(i, i + size);
    parsedBytes += size;
    return { parsedBytes, insertContent };
}

function parseCopy(data, i) {
    let offSetBytes = [];
    let sizeBytes = [];
    let mask = data[i]; // 10000000
    let parsedBytes = 1;
    i++;

    if (mask === 0x10000) {
        sizeBytes = 0;
    }

    for (let k = 0; k < 7; k++) {
        if (k < 4) {
            // 4 bits in mask
            if (mask & (1 << k)) {
                offSetBytes.push(data[i]);
                i++;
                parsedBytes++;
            } else {
                offSetBytes.push(0);
            }
        } else if (k >= 4) {
            // 3 bits in mask
            if (mask & (1 << k)) {
                sizeBytes.push(data[i]);
                i++;
                parsedBytes++;
            } else {
                sizeBytes.push(0);
            }
        }
    }

    let offset = 0;
    for (let [index, value] of offSetBytes.entries()) {
        offset += value << (index * 8);
    }

    let size = 0;
    for (let [index, value] of sizeBytes.entries()) {
        size += value << (index * 8);
    }

    return {
        parsedBytes,
        offset,
        size,
    };
}

function parseSize(data, i) {
    size = data[i] & 127;
    parsedBytes = 1;
    offset = 7;
    while (data[i] > 127) {
        i++;
        size += (data[i] & 127) << offset;
        parsedBytes++;
        offset += 7;
    }
    return { parsedBytes, size };
}

module.exports = clone;