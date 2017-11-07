// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const $ = require('jquery');
const path = require('path');
const {shell} = require('electron');

const dblib = require('./db.js');
const omdb = require('./omdb.js');

dblib.updateDB().then(res => {
  console.log(res)
}).catch(err => {
  console.log(err)
});

var root = $("<div class='main_root'></div>")
dblib.db.forEach(film_o => {
  var container = $('<div class="main_container"></div>')
  var localPoster = film_o['localPoster'];
  var title = film_o['title'];
  if (film_o.omdb && film_o.omdb.localPoster || localPoster) {
    localPoster = localPoster || film_o.omdb.localPoster;
    title = title || film_o.omdb.Title;
    var poster = $("<div class=\"poster\"><span class='play'><i class=\"fa fa-play-circle\" aria-hidden=\"true\"></i></span></div>")
    poster.css('background-image', 'url(\"./cache/omdb/' + path.basename(localPoster) + '\")')
    poster.click(_ => {
      playVideo(film_o.path)
    })
    // poster.on('contextmenu', _ => {
    //   alert("coco")
    // })
    container.append(poster)
    container.append(`<div class="main_title">${title}</div>`)
  } else {
    container.append("<div class=\"poster_empty\"><span class='film'><i class=\"fa fa-film\" aria-hidden=\"true\"></i></span></div>")
    container.append(`<div class="main_title_empty">${omdb.normFileTitle(path.basename(film_o.path))}</div>`)
    container.click(_ => {
      playVideo(film_o.path)
    })
  }
  root.append(container)
})
$("#app").append(root)

function shortenString(s) {
  // écrit une version courte de la string en question
  if (s.length > 30) {
    return s.substr(0, 20) + "..." + s.substr(s.length - 4)
  } else {
    return s
  }
}

function playVideo(path) {
  shell.openItem(path);
}

module.exports.db = dblib.db;
module.exports.playVideo = playVideo;
