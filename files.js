const fs = require('fs');
const path = require('path');
const async = require('async');

function listMoviesPaths(dir_path) {
  // return a list of paths to the movies in dir_path
  return new Promise((resolve, reject) => {
    walk(dir_path, function(err, results) {
      if (err) reject(err);
      else resolve(results.sort())
    });
  })
}

// only for internal use in this module, it is used in listMoviesPaths function for ex
var walk = function(dir, done) {
  var results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    var pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          if (/\.(mp4|mkv|avi|webm|flv|ogv|mov|mpg|mpeg|m4v|3gp)$/gi.test(file)) results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
};

function createDir(path) {
  // creates the dir if it doesn't exist already
  return new Promise((resolve, reject) => {
    isDir(path).then(res => {
      if (!res) {
        fs.mkdir(path, err => {
          if (err) {
            reject(err)
          } else {
            resolve("Directory " + path + " created !")
          }
        })
      } else {
        resolve("Directory already exists")
      }
    }).catch(err => {
      reject(err)
    })
  })
}

function isDir(path) {
  return new Promise((resolve, reject) => {
    fs.stat(path, function(err, stats) {
      if (err) {
        resolve(false)
        //return fs.mkdir("temp/" + seriesid, callback);
      }
      if (!stats || !stats.isDirectory()) {
        // This isn't a directory!
        resolve(false)
      } else {
        resolve(true)
      }
    });
  })
}

function clearDir(dir_path) {
  return new Promise((resolve, reject) => {
    fs.readdir(dir_path, (err, files) => {
      if (err) {
        reject(err)
        return
      }
      // on supprime tous les fichiers
      async.map(files, (file, cbk) => {
        fs.unlink(path.join(dir_path, file), err => {
          if (err) cbk(err, null)
          else cbk(null, file)
        })
        // à la fin on rejette ou non :)
      }, (err, res) => {
        if (err) reject(err)
        else resolve(res)
      })
    })
  })
}

// walk(ROOT, function(err, results) {
//   if (err) throw err;
//   console.log(results);
// });

module.exports.listMoviesPaths = listMoviesPaths;
module.exports.createDir = createDir;
module.exports.clearDir = clearDir;
module.exports.isDir = isDir;
