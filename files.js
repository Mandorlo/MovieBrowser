const fs = require('fs');
const path = require('path');

function listMoviesPaths(dir_path) {
  // return a list of paths to the movies in dir_path
  return new Promise((resolve, reject) => {
    walk(dir_path, function(err, results) {
      if (err) reject(err);
      else resolve(results)
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

// walk(ROOT, function(err, results) {
//   if (err) throw err;
//   console.log(results);
// });

module.exports.listMoviesPaths = listMoviesPaths;
