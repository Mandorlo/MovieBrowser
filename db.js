const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const request = require('request');

const omdb = require('./omdb.js');
const files = require('./files.js');

const db_path = path.join(__dirname, "db.json");
const db = require(db_path);

const ROOT = "D:\\Films\\";
const CACHE = path.join(__dirname, "cache");

/* Format d'un objet film :
{
  "path": "D:\\chemin\\vers\\le\\film.mp4",
  "omdb": objet résultat omdb
}
*/

function updateDB(type = "light") {
  if (type == "reset") { // on réinitialise la base
    db = []
  }

  return new Promise((resolve, reject) => {
    // on liste les films dans ROOT
    files.listMoviesPaths(ROOT).then(movies_list => {
      var count_http_call = 0;
      movies_list.forEach(movie_path => {
        // pour chaque film on extrait le titre du nom du fichier
        var fname = path.basename(movie_path)
        var title = omdb.normFileTitle(fname)

        // si le film n'est pas dans la base
        var res = _.find(db, ['path', movie_path])
        if (!res) {
          // on le cherche dans omdb
          setTimeout(() => {
            omdb.searchFilm(title).then(res => {
              db.push({
                "path": movie_path,
                "omdb": res
              })
              count_http_call++
              // console.log(count_http_call + "/" + movies_list.length)
              if (count_http_call >= movies_list.length) {
                console.log("Writing updated DB to disk...")
                fs.writeFile(db_path, JSON.stringify(db, null, '\t'), 'utf8', err => {
                  if (err) reject(err);
                  else resolve(db)
                })
              }
            }).catch(err => {
              count_http_call++
              // console.log(count_http_call + "/" + movies_list.length)
              console.log("No result for " + title)
              if (count_http_call >= movies_list.length) {
                console.log("Writing updated DB to disk...")
                fs.writeFile(db_path, JSON.stringify(db, null, '\t'), 'utf8', err => {
                  if (err) reject(err);
                  else resolve(db)
                })
              }
            })
          }, parseInt(Math.random() * 3000))
        }
      })
    }).catch(err => {
      reject(err)
    })
  })
}

function cacheWebResources() {
  // caches poster images in the cache directory
  // à utiliser uniquement en ligne de commande
  db.forEach(film => {
    setTimeout(() => {
      // we download the poster in the cache
      res = /\.(jpg|png|gif|jpeg)/gi.exec(film.omdb.Poster)
      if (res && res.length > 0) {
        var random_id = genRandomId(CACHE, res[0]);
        download(film.omdb.Poster, path.join(CACHE, random_id + res[0]), _ => {
          console.log("done")
          // TODO : modifier le path dans la db et écrire la nouvelle db à la fin
        })
      }
    }, parseInt(Math.random() * 3000))
  })
}

function genRandomId(path_dir, ext) {
  // TODO generate a random filename with extension ext (for ex .jpg), that doesn't exists in path_dir
}

var download = function(uri, filename, callback){
  request.head(uri, function(err, res, body){
    console.log('content-type:', res.headers['content-type']);
    console.log('content-length:', res.headers['content-length']);

    request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
  });
};

// download('https://www.google.com/images/srpr/logo3w.png', 'google.png', function(){
//   console.log('done');
// });

module.exports.updateDB = updateDB;
