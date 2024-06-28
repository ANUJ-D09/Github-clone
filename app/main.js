 function sliceHash(Hash) {
     return Hash.slice(0, 2) + '/' + Hash.slice(2);
 }

 function listTreeContent(shaHash) {
     const filePath = sliceHash(shaHash);
     const fileContent = decompressData(fs.readFileSync(`.git/objects/${filePath}`));
     const tree = fileContent.toString().split("\0").slice(1);
     const fileNames = [];
     for (let i = 0; i < tree.length; i++) {
         fileNames.push(tree[i].split(' ')[1]);
     }
     process.stdout.write(fileNames.join("\n"));
 }