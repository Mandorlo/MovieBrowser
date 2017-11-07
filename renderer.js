// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const $ = require('jquery');
const fs = require('fs');
const path = require('path');
const {
  shell
} = require('electron');

const dblib = require('./db.js');
const omdb = require('./omdb.js');

dblib.updateDB().then(res => {
  console.log(res)
}).catch(err => {
  console.log(err)
});


renderDashboard()

function renderDashboard() {
  var root = $("<div class='main_root'></div>")

  // var button = document.querySelector('button.change_poster');
  // var dialog = $('#change_poster');
  $('#change_poster').find('button.close:not([disabled])').click(_ => {
    document.querySelector("#change_poster").close();
  });
  $('#change_infos').find('button.close:not([disabled])').click(_ => {
    document.querySelector("#change_infos").close();
  });

  dblib.db.forEach(film_o => {
    if (fs.existsSync(film_o.path)) {
      var hash = dblib.getId(film_o)
      var container = $('<div class="main_container" id="' + hash + '"></div>')
      var localPoster = film_o['localPoster'];
      var title = film_o['title'];

      // on ajoute le div qui servira de zone de hover pour faire apparaître les boutons d'edition
      var edition = $('<div class="edition"></div>')

      // on ajoute le bouton pour changer de poster
      var b = createChangePosterButton(film_o)
      edition.append(b)

      // on ajoute le bouton pour changer les infos du film
      b = createChangeInfoButton(film_o)
      edition.append(b)

      container.append(edition)

      // si on a un poster
      if (film_o.omdb && film_o.omdb.localPoster || localPoster) {
        localPoster = localPoster || film_o.omdb.localPoster;
        if (film_o && film_o.omdb && film_o.omdb.Title) title = film_o.omdb.Title;
        var poster = $("<div class=\"poster\"><span class='play'><i class=\"fa fa-play-circle\" aria-hidden=\"true\"></i></span></div>")
        poster.css('background-image', 'url(\"./cache/omdb/' + path.basename(localPoster) + '\")')
        poster.click(_ => {
          playVideo(film_o.path)
        })
        container.append(poster)
        container.append(`<div class="main_title">${title}</div>`)
        // si on n'a pas de poster
      } else {
        var poster_empty = ("<div class=\"poster_empty\"><span class='film'><i class=\"fa fa-film\" aria-hidden=\"true\"></i></span></div>")
        container.append(poster_empty);
        container.append(`<div class="main_title_empty">${omdb.normFileTitle(path.basename(film_o.path))}</div>`)
        container.click(_ => {
          playVideo(film_o.path)
        })
      }

      root.append(container)
    }
  })
  $("#app").append(root)
}

function createChangeInfoButton(film_o) {
  var button = $('<button class="edition_buttons change_poster mdl-button mdl-js-button mdl-button--fab mdl-button--colored"><i class="fa fa-info" aria-hidden="true"></i></button>')
  button.click(e => {
    e.stopPropagation();
    var title = film_o.title;
    title = (film_o.omdb && film_o.omdb.Title) ? film_o.omdb.Title : title;
    title = (title) ? title : "";
    if (title) $("#dialog_info_title").val(title)

    var ok = $('#ok_change_infos')
    ok.unbind("click");
    ok.click(e => {
      film_o.title = $("#dialog_info_title").val();
      if (film_o.omdb) film_o.omdb.Title = film_o.title;
      dblib.updateFilmInfo(film_o.path, film_o).then(_ => {
        console.log("infos updated for film " + film_o.title)
        var hash = dblib.getId(film_o)
        var mtitle = $("#" + hash).find(".main_title")
        if (!mtitle.length) mtitle = $("#" + hash).find(".main_title_empty");
        if (mtitle.length) mtitle.eq(0).html(film_o.title);
        else console.log("cannot find element with id " + hash)
        document.querySelector("#change_infos").close();
      }).catch(err => {
        console.log("Error updating film infos", err)
        document.querySelector("#change_infos").close();
      })
    })
    document.querySelector("#change_infos").showModal();
  })
  return button
}

function createChangePosterButton(film_o) {
  var button = $('<button class="edition_buttons change_poster mdl-button mdl-js-button mdl-button--fab mdl-button--colored"><i class="fa fa-picture-o" aria-hidden="true"></i></button>')

  button.click(e => {
    e.stopPropagation();
    var title = film_o.title;
    title = (film_o.omdb && film_o.omdb.Title) ? film_o.omdb.Title : title;
    title = (title) ? title : "";

    // on modifie dialog avec les infos du film
    var dialog = $("#change_poster");
    var poster_text = dialog.find("#dialog_poster_text")
    var t = poster_text.html();
    poster_text.html(t + "<b>" + title + "</b>");

    var poster_path = "";
    if (film_o.omdb && film_o.omdb.localPoster) poster_path = film_o.omdb.localPoster;
    else if (film_o.omdb && film_o.omdb.Poster) poster_path = film_o.omdb.Poster;
    dialog.find("#dialog_poster_url").val(poster_path);

    var ok = $('#ok_change_poster')
    ok.unbind("click");
    ok.click(e => {
      var url_poster = $("#dialog_poster_url").val();
      if (/^https?\:\/\//gi.test(url_poster)) {
        dblib.updatePoster(film_o, url_poster).then(o => {
          console.log("poster mis à jour", o.localPoster)
          var hash = dblib.getId(film_o)
          // on met à jour l'image dans l'UI
          $("#" + hash).find(".poster").eq(0).css('background-image', 'url(\"./cache/omdb/' + path.basename(o.localPoster) + '\")')
          document.querySelector("#change_poster").close();
        }).catch(err => {
          console.log("Erreur lors de la mise à jour du film", err)
          document.querySelector("#change_poster").close();
        })
      } else {
        console.log("L'url '" + url_poster + "' n'est pas valide !")
        document.querySelector("#change_poster").close();
      }
    })

    document.querySelector("#change_poster").showModal();
  })
  return button
}

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
