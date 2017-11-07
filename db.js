const fs = require('fs');
const path = require('path');
const request = require('request');
const hash = require('crypto').createHash;
const _ = require('lodash');

const omdb = require('./omdb.js');
const files = require('./files.js');

const db_path = path.join(__dirname, "db.json");
var db = require(db_path);

const ROOT = "D:\\Films\\";
const CACHE = path.join(__dirname, "cache");
const CACHE_OMDB = path.join(CACHE, "OMDB");

files.createDir(CACHE_OMDB)
// updateDB("reset").then(res => console.log(res)).catch(err => console.log(err))

/* Format d'un objet film :
{
  "path": "D:\\chemin\\vers\\le\\film.mp4",
  "omdb": objet résultat omdb
}
*/

function updateDB(type = "light") {
  return new Promise((resolve, reject) => {
    if (type == "reset") { // on réinitialise la base
      console.log("Resetting db...")
      db = []
      files.clearDir(CACHE_OMDB).then(_ => {
        updateDBAux(type).then(res => resolve(res)).catch(err => reject(err))
      }).catch(err => {
        reject(err)
      })
    } else {
      updateDBAux(type).then(res => resolve(res)).catch(err => reject(err))
    }
  })
}

function updateDBAux(type) {
  return new Promise((resolve, reject) => {
    // on liste les films dans ROOT
    files.listMoviesPaths(ROOT).then(movies_list => {
      var count_http_call = 0;
      var myPromises = [];
      var count_http_call = 0;
      // movies_list = movies_list.slice(139,140);
      Promise.all(movies_list.map(movie_path => {
        // si le film n'est pas dans la base
        return new Promise((resolve2, reject2) => {
          var res = _.find(db, ['path', movie_path])
          if (!res) {
            // on le cherche dans omdb
            // setTimeout(() => {
            getOMDBFilm(movie_path).then(film_o => {
              db.push(film_o)
              count_http_call++
              printText(count_http_call + "/" + movies_list.length)
              resolve2(film_o)
            }).catch(err => {
              db.push({
                path: movie_path,
                omdb: null
              })
              count_http_call++
              printText(count_http_call + "/" + movies_list.length)
              resolve2(err) // on fait exprès de pas générer d'erreur si on trouve pas le film
            })
            // }, parseInt(Math.random() * 5000))
          } else {
            // console.log(movie_path + "already exists in db")
            resolve2(movie_path + "already exists in db")
          }
        })
        // when all promises are finished
      })).then(results => {
        // we write the db on disk
        fs.writeFile(db_path, JSON.stringify(db, null, '\t'), 'utf8', err => {
          if (err) {
            reject({
              err1: err,
              err2: err2
            });
            return
          }
          resolve("db saved")
        })
      }).catch(err => { // this is never called by design
        reject(err)
      })
    }).catch(err => { // listMoviesPaths failed
      reject(err)
    })
  })
}

function getOMDBFilm(movie_path) {
  var fname = path.basename(movie_path)
  var title = omdb.normFileTitle(fname)
  return new Promise((resolve, reject) => {
    omdb.searchFilm(title).then(res => {
      var o = {
        "path": movie_path,
        "omdb": res
      }
      // on cache le poster
      cacheWebResource(o).then(new_o => {
        resolve(new_o)
      }).catch(err => {
        reject({
          path: "getOMDBFilm/cacheWebResource",
          err: err
        })
      })
    }).catch(err => {
      // console.log("no film found with search '" + title + "'")
      reject({
        path: "getOMDBFilm/omdb.searchFilm",
        err: err
      })
    })
  })
}

function cacheWebResource(film_o) {
  // caches poster images of the film object film_o and returns the new object with the localPoster attribute in film_o.omdb
  return new Promise((resolve, reject) => {
    // we download the poster in the cache
    res = /\.(jpg|png|gif|jpeg)$/gi.exec(film_o.omdb.Poster)
    if (!film_o.omdb.localPoster && res && res.length > 0) {
      var random_path = genRandomId(CACHE_OMDB, res[0]);
      download(film_o.omdb.Poster, random_path).then(path => {
        film_o.omdb.localPoster = path;
        resolve(film_o)
      }).catch(err => {
        reject(err)
      })
    } else if (film_o.omdb.Poster == "N/A") {
      film_o.omdb.localPoster = "";
      reject({
        err: "POSTER_NA",
        o: film_o
      })
    } else {
      film_o.omdb.localPoster = null;
      reject({
        type: "NO_POSTER",
        err: JSON.stringify(film_o),
        o: film_o
      })
    }
  })
}

function updateFilmInfo(film_path, new_film_o) {
  var db_index = _.findIndex(db, ['path', new_film_o.path])
  if (db_index < 0) {
    return Promise.reject("Cannot find path to film '" + new_film_o.path + "' in db :(")
  }
  db.splice(db_index, 1, new_film_o)
  return writeDB()
}

function updatePoster(film_o, new_url) {
  if (!film_o.path) return Promise.reject("film_o provided is not a valid film object !");

  return new Promise((resolve, reject) => {
    var db_index = _.findIndex(db, ['path', film_o.path])
    if (db_index < 0) {
      reject("Cannot find path '" + film_o.path + "' in db :(")
      return
    }
    // we download the poster in the cache
    res = /\.(jpg|png|gif|jpeg)$/gi.exec(new_url)
    if (res && res.length > 0) {
      var random_path = genRandomId(CACHE_OMDB, res[0]);
      download(new_url, random_path).then(path => {
        if (film_o.omdb && film_o.omdb.localPoster && fs.existsSync(film_o.omdb.localPoster)) {
          // on supprime l'ancien poster dans le cache
          fs.unlink(film_o.omdb.localPoster, err => {
            if (err) console.log("Error while deleting poster " + film_o.omdb.localPoster, err)
          })
        }

        film_o.localPoster = path;
        if (film_o.omdb) film_o.omdb.localPoster = path;
        db.splice(db_index, 1, film_o)
        // on écrit la db mise à jour
        writeDB().then(_ => {
          resolve(film_o)
        }).catch(err => {
          reject(err)
        })

      }).catch(err => {
        reject(err)
      })
    } else {
      film_o.omdb.localPoster = null;
      reject("extension of url '" + url + "' is not an image")
    }
  })
}

function writeDB() {
  return new Promise((resolve, reject) => {
    fs.writeFile(db_path, JSON.stringify(db, null, '\t'), 'utf8', err => {
      if (err) {
        reject(err);
        return
      }
      resolve("db saved")
    })
  })
}

function getId(film_o) {
  // renvoie un id cool du film à partir du path
  if (!film_o || !film_o.path) throw "unvalid object film to get id from"
  return hash('md5').update(film_o.path).digest('hex');
}

function genRandomId(path_dir, ext) {
  // generate a random filename with extension ext (for ex .jpg), that doesn't exists in path_dir
  ext = (ext[0] != ".") ? "." + ext : ext;
  var arr = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
  var fname = "";
  for (var i = 0; i < 20; i++) fname += arr[parseInt(Math.random() * arr.length)];
  var mypath = path.join(path_dir, fname + ext)
  var c = 0
  while (fs.existsSync(mypath) && c < 10000) {
    fname = ""
    for (var i = 0; i < 20; i++) fname += arr[parseInt(Math.random() * arr.length)];
    mypath = path.join(path_dir, fname + ext)
    c++
  }
  return mypath
}

function download(uri, path) {
  return new Promise((resolve, reject) => {
    request.head(uri, function(err, res, body) {
      if (err) {
        reject(err)
        return
      }
      // console.log('content-type:', res.headers['content-type']);
      // console.log('content-length:', res.headers['content-length']);
      request.get(uri)
        .on('response', res => {})
        .on('error', err => {
          reject(err)
        })
        .pipe(fs.createWriteStream(path))
        .on('close', res => {
          resolve(path)
        })
        .on('error', err => {
          reject(err)
        });
    })
  })
};
// TEST :
// download("https://images-na.ssl-images-amazon.com/images/M/MV5BMWQ2MjQ0OTctMWE1OC00NjZjLTk3ZDAtNTk3NTZiYWMxYTlmXkEyXkFqcGdeQXVyMTQxNzMzNDI@._V1_SX300.jpg", './test.jpg').then(res => console.log(res)).catch(err => console.log(err))

module.exports.db = db;
module.exports.getId = getId;
module.exports.updateDB = updateDB;
module.exports.getOMDBFilm = getOMDBFilm;
module.exports.updateFilmInfo = updateFilmInfo;
module.exports.updatePoster = updatePoster;

function printText(texte) {
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(texte);
}
