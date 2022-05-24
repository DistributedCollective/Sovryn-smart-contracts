const glob = require('glob');
const fs = require('fs');

// this script is intended to fill in the JSON lists, the paths for JSON files with bytecodes
var configJSON = require('./contract_config.json');
// this is the standard set of places where to look for
var folders = ['../../artifacts/contracts', '../../solidity/build/contracts', '../../rbtcwrapperproxy/build/contracts'];

// 'folders' is an array and name is a string, the contract's name
// this function will try to find the path in which it is found the JSON file 
// with the Bytecode of the contract named as the string 'name'
function findMe(folders, name) {
  let flag = false;
  for(let i = 0; i < folders.length; ++i) {
    if (fs.existsSync(folders[i])) {
      flag = true;
      var Pattern = folders[i] + '/**/' + name + '.json';
      // console.log(Pattern);
      var list = glob.sync(Pattern, {});
      if (list.length > 0) break;
    } 
  }
  if (!flag) {
    console.log('build folders not found, please make sure dependencies are installed and run the proper compile script');
    return null;
  } 
  return list;
}

// this function takes the JSON file with all the contract's names
// and the list of all possible folders where to look for the bytecodes of these contacts
// and will try to find for each contract all the bytecode file paths
function listMe(folders, F) {
  var L = Object.keys(F).length;  
  console.log("\n \n looking for ", L, " contracts \n");
  for (let i = 0; i < L; i++){
    draw(i,L,0);
    var Pth = "./";
    var name = Object.keys(F)[i];    
    var list = findMe(folders, name);
    // console.log(list.length);
    if (list == null) return F;
    if (list.length > 0) Pth = list[0];
    if (F[name][1] == "./" || F[name][1] == null || F[name][1] == undefined) {
      F[name][1] = Pth;
    }    
  }
  return F;
}

function draw(P, Bx, B0) {
  var Length = (Bx - B0);
  // here we have a little bug in the progress... 100% not reached (minor, to be fixed)
  const percentage_progress = (((P - B0 + 1)/Length) * 100).toFixed(2);
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(
      `Current progress: [processing element number: ${P}] | ${percentage_progress}%`
  );
}

// finally this function cycles through all lists of contracts
// to find all the paths with JSON files contentive of Bytecodes
function workWithFiles(c, f) {
  let l = Object.keys(c).length;
  for (let k = 0; k < l; ++k) {
    let p = c[Object.keys(c)[k]][2];
    if (fs.existsSync(p)) {
      let F = require(p);
      F = listMe(f, F);
      F = JSON.stringify(F, null, 2);
      fs.writeFileSync(p, F);
    } else {
      console.log('make sure that all JSON files are initialized');
    }
  }
}

workWithFiles(configJSON, folders)
