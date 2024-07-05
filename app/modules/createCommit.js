const { writeGitObject, sha1 } = require("./utils");
const fs = require("fs");
const crypto = require("crypto");
const zlib = require("zlib");
const path = require("path");

function getFormattedUtcOffset() {
    const date = new Date();
    const offsetMinutes = -date.getTimezoneOffset();
    const offsetHours = Math.abs(Math.floor(offsetMinutes / 60));
    const offsetMinutesRemainder = Math.abs(offsetMinutes) % 60;
    const sign = offsetMinutes < 0 ? "-" : "+";
    const formattedOffset = `${sign}${offsetHours
    .toString()
    .padStart(2, "0")}${offsetMinutesRemainder.toString().padStart(2, "0")}`;
    return formattedOffset;
}

function commitObject(tree_hash, commit_hash, message) {
    let contents = Buffer.from("tree " + tree_hash + "\n");
    if (commit_hash) {
        contents = Buffer.concat([
            contents,
            Buffer.from("parent " + commit_hash + "\n"),
        ]);
    }
    let seconds = new Date().getTime() / 1000;
    const utcOffset = getFormattedUtcOffset();
    contents = Buffer.concat([
        contents,
        Buffer.from(
            "author " +
            "harshit " +
            "<harshit_chaudhary@mail.com> " +
            seconds +
            " " +
            utcOffset +
            "\n",
        ),
        Buffer.from(
            "committer " +
            "harshit " +
            "<harshit_chaudhary@mail.com> " +
            seconds +
            " " +
            utcOffset +
            "\n",
        ),
        Buffer.from("\n"),
        Buffer.from(message + "\n"),
    ]);
    let finalContent = Buffer.concat([
        Buffer.from("commit " + contents.length + "\0"),
        contents,
    ]);
    let new_object_path = crypto
        .createHash("sha1")
        .update(finalContent)
        .digest("hex");
    fs.mkdirSync(path.join(".git", "objects", new_object_path.slice(0, 2)), {
        recursive: true,
    });
    fs.writeFileSync(
        path.join(
            ".git",
            "objects",
            new_object_path.slice(0, 2),
            new_object_path.slice(2),
        ),
        zlib.deflateSync(finalContent),
    );
    process.stdout.write(new_object_path);
    return;
}

module.exports = commitObject;