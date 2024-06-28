import * as fs from "node:fs";
import * as path from "node:path/posix";
import * as zlib from "node:zlib";
import * as process from "node:process";
import * as crypto from "node:crypto";
const command = process.argv[2];
switch (command) {
    case "init":
        createGitDirectory();
        break;
    case "cat-file":
        readGitBlob(process.argv[4]);
        break;
    case "hash-object":
        hashGitObject(process.argv[4]);
        break;
    default:
        throw new Error(`Unknown command ${command}`);
}

function createGitDirectory() {
    fs.mkdirSync(path.join(process.cwd(), ".git"), { recursive: true });
    fs.mkdirSync(path.join(process.cwd(), ".git", "objects"), {
        recursive: true,
    });
    fs.mkdirSync(path.join(process.cwd(), ".git", "refs"), { recursive: true });
    fs.writeFileSync(
        path.join(process.cwd(), ".git", "HEAD"),
        "ref: refs/heads/main\n",
        "utf-8",
    );
    console.log("Initialized git directory");
}
/** @param {string} blobSha  */
function readGitBlob(blobSha) {
    const objDir = blobSha.substring(0, 2);
    const objFile = blobSha.substring(2);
    const data = fs.readFileSync(
        path.join(process.cwd(), ".git", "objects", objDir, objFile),
    );
    const inflated = zlib.inflateSync(data).toString();
    const [_prefix, content] = inflated.split("\0");
    process.stdout.write(content);
}
/** @param {string} file */
function hashGitObject(file) {
    const { size } = fs.statSync(file);
    const data = fs.readFileSync(file);
    const content = `blob ${size}\0${data.toString()}`;
    const blobSha = crypto.createHash("sha1").update(content).digest("hex");
    const objDir = blobSha.substring(0, 2);
    const objFile = blobSha.substring(2);
    fs.mkdirSync(path.join(process.cwd(), ".git", "objects", objDir), {
        recursive: true,
    });
    fs.writeFileSync(
        path.join(process.cwd(), ".git", "objects", objDir, objFile),
        zlib.deflateSync(content),
    );
    process.stdout.write(`${blobSha}\n`);
}