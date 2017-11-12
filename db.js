const fs = require('fs');
const path = require('path');
const request = require('request');
const hash = require('crypto').createHash;
const _ = require('lodash');
const removeDiacritics = require('diacritics').remove;

const omdb = require('./omdb.js');
const files = require('./files.js');

const db_path = path.join(__dirname, "db.json");
var db = require(db_path);


const param_path = path.join(__dirname, "param.json")
var PARAM = require(param_path);
var ROOT = PARAM.films_dir;
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

/* ============================== GETTERS AND SETTERS  =================================== */

function getTitle(o_or_s) { // o_or_s is either the film object or its path
  var film_o = getFilm(o_or_s)
  if (!film_o) return "";
  var titre = omdb.normFileTitle(path.basename(film_o.path));
  if (film_o.omdb && film_o.omdb.Title) titre = film_o.omdb.Title;
  if (film_o.title && film_o.title != "") titre = film_o.title
  return titre
}

function getTags(o_or_s) {
  var film_o = getFilm(o_or_s)
  if (!film_o) return [];
  if (film_o.tags) return film_o.tags;
}

function str2Tags(s) { // s = "drôle comédie humour etranger"
  var news = removeDiacritics(s)
  return arr = news.split(' ')
}

function getFilm(s) {
  // renvoie l'objet film correspondant à s
  // si s est une string, s = path to the film
  if (typeof s == "string") return _.find(db, ['path', s])
  // sinon c'est l'objet film
  else return s
}

/* ================================================================= */

function cleanDB() {
  var newdb = [];
  db.forEach(m => {
    if (m.title || m.omdb || m.localPoster) newdb.push(m)
  })
  newdb = _.uniqBy(newdb, "path");
  db = newdb;
}

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
          if (!res || !res.omdb || !res.omdb.Title) {
            // on le cherche dans omdb
            // setTimeout(() => {
            getOMDBFilm(movie_path).then(film_o => {
              film_o.date_ajout = moment().format("YYYYMMDD");
              db.push(film_o)
              count_http_call++
              // printText(count_http_call + "/" + movies_list.length)
              resolve2(film_o)
            }).catch(err => {
              db.push({
                path: movie_path,
                omdb: null
              })
              count_http_call++
              // printText(count_http_call + "/" + movies_list.length)
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
        // we clean the DB
        cleanDB()
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

function getOMDBFilm(movie_path, title = null) {
  if (!title) {
    var fname = path.basename(movie_path)
    title = omdb.normFileTitle(fname)
  }

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

function findFilmLocal(movie_path) {
  var fname = path.basename(movie_path)
  var title = omdb.normFileTitle(fname)
  var title_arr = title.split(' ');
  var film_o = null;
  var notes = [];
  db.forEach(el => {
    if (path.basename(el.path) == fname) {
      film_o = el
    }
    var manote = 0.0;
    title_arr.forEach(mot => {
      if (el.title && el.title.indexOf(mot.trim()) >= 0) manote++
        else if (el.omdb && el.omdb.Title && el.omdb.Title.indexOf(mot.trim()) >= 0) manote++
    })
    manote = manote / parseFloat(title_arr.length);
    notes.push(manote)
  })
  if (!film_o) {
    var ind = notes.indexOf(_.max(notes))
    if (ind >= 0) return
  } else {
    return film_o
  }
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
    db.push(new_film_o)
  } else {
    db.splice(db_index, 1, new_film_o)
  }
  return writeDB()
}

function updateOMDBFilm(movie_path, title = null) {
  // update les infos omdb du film et les écrit sur disque
  return new Promise((resolve, reject) => {
    getOMDBFilm(movie_path, title).then(new_film_o => {
      var film_o = _.find(db, ['path', movie_path]);
      if (film_o) {
        film_o.omdb = new_film_o.omdb;
        if (new_film_o.localPoster) film_o.localPoster = new_film_o.localPoster;
        if (new_film_o.omdb.localPoster) film_o.localPoster = new_film_o.omdb.localPoster;
        if (!film_o.title || film_o.title.substr(0,2) == "tt") film_o.title = new_film_o.omdb.Title;
      } else film_o = new_film_o;
      console.log("film",film_o)
      updateFilmInfo(movie_path, film_o).then(res => {
        resolve(film_o)
      }).catch(err => {
        reject(err)
      })
    }).catch(err => {
      reject(err)
    })
  })
}

function updatePoster(film_o, new_url) {
  if (!film_o.path) return Promise.reject("film_o provided is not a valid film object !");

  return new Promise((resolve, reject) => {
    var db_index = _.findIndex(db, ['path', film_o.path])

    // we download the poster in the cache
    var ext = ".jpg";
    res = /\.(jpg|png|gif|jpeg)$/gi.exec(new_url)
    if (res && res.length > 0) ext = res[0];
    var random_path = genRandomId(CACHE_OMDB, ext);
    download(new_url, random_path).then(path => {
      if (film_o.omdb && film_o.omdb.localPoster && fs.existsSync(film_o.omdb.localPoster)) {
        // on supprime l'ancien poster dans le cache
        fs.unlink(film_o.omdb.localPoster, err => {
          if (err) console.log("Error while deleting poster " + film_o.omdb.localPoster, err)
        })
      }

      film_o.localPoster = path;
      if (film_o.omdb) film_o.omdb.localPoster = path;
      if (db_index < 0) {
        db.push(film_o)
      } else {
        db.splice(db_index, 1, film_o)
      }
      // on écrit la db mise à jour
      writeDB().then(_ => {
        resolve(film_o)
      }).catch(err => {
        reject(err)
      })

    }).catch(err => {
      reject(err)
    })
    // } else {
    //   film_o.omdb.localPoster = null;
    //   reject("extension of url '" + url + "' is not an image")
    // }
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

function writeParam() {
  return new Promise((resolve, reject) => {
    fs.writeFile(param_path, JSON.stringify(PARAM, null, '\t'), 'utf8', err => {
      if (err) {
        reject(err);
        return
      }
      resolve("params saved")
    })
  })
}

function getId(film_o) {
  if (typeof film_o == "string" || !film_o) return film_o;
  // renvoie un id cool du film à partir du path
  if (!film_o || !film_o.path) throw "invalid object film to get id from" + JSON.stringify(film_o,null,'  ')
  return hash('md5').update(path.basename(film_o.path)).digest('hex');
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
function getFilmDir() {
  return ROOT
}

function setFilmDir(path) {
  return new Promise((resolve, reject) => {
    files.isDir(path).then(res => {
      if (res) {
        ROOT = path;
        PARAM.films_dir = path;
        writeParam().then(res => resolve(res)).catch(err => reject(err))
      } else {
        reject("Path " + path + " is not a valid directory !")
      }
    }).catch(err => {
      reject(err)
    })
  })
}

module.exports.db = db;
module.exports.getId = getId;
module.exports.getTitle = getTitle;
module.exports.getFilm = getFilm;
module.exports.getTags = getTags;
module.exports.str2Tags = str2Tags;

module.exports.download = download;

module.exports.updateDB = updateDB;
module.exports.writeDB = writeDB;
module.exports.getFilmDir = getFilmDir;
module.exports.setFilmDir = setFilmDir;
module.exports.getOMDBFilm = getOMDBFilm;
module.exports.updateFilmInfo = updateFilmInfo;
module.exports.updatePoster = updatePoster;
module.exports.updateOMDBFilm = updateOMDBFilm;

function printText(texte) {
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(texte);
}
