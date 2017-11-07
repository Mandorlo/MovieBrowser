// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const $ = require('jquery');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const {
  shell
} = require('electron');

const dblib = require('./db.js');
const omdb = require('./omdb.js');
const files = require("./files.js");
const ui = require('./ui.js');

dblib.updateDB().then(res => {
  console.log(res)
}).catch(err => {
  console.log(err)
});

function renderDashboard() {
  $("#app").empty()

  // on affiche la barre de navigation
  var navbar = createNavbar();
  $("#app").append(navbar)

  var root = $("<div class='main_root'></div>")

  $('#change_poster').find('button.close:not([disabled])').click(_ => {
    document.querySelector("#change_poster").close();
  });
  $('#change_infos').find('button.close:not([disabled])').click(_ => {
    document.querySelector("#change_infos").close();
  });
  $('#change_root').find('button.close:not([disabled])').click(_ => {
    document.querySelector("#change_root").close();
  });

  var root_dir = dblib.getFilmDir();
  var myPromises = [];
  files.listMoviesPaths(root_dir).then(mov_list => {
    mov_list = _.shuffle(mov_list); // on met un peu d'aléa dans la liste
    console.log(mov_list.length + " films trouvés ! Merci Seigneur !")
    mov_list.forEach(mov_path => {
      // on cherche le film dans la base
      var mov_path_fname = path.basename(mov_path)
      var film_o = _.find(dblib.db, p => {
        return (path.basename(p.path) == mov_path_fname)
      })
      if (film_o) film_o.path = mov_path;

      // si on ne le trouve pas on récupère les infos depuis omdb
      if (!film_o) {
        var p = new Promise((resolve2, reject2) => {
          dblib.getOMDBFilm(mov_path).then(r => resolve2(r)).catch(err => resolve2(err))
        })
        myPromises.push(p);
        p.then(o => {
          if (!o.err) {
            dblib.db.push(o)
            film_o = o
            if (film_o && path.basename(film_o.path) == path.basename(mov_path) && fs.existsSync(film_o.path)) {
              film_o.path = mov_path
              var card = renderFilmCard(film_o);
              root.append(card)
            } else {
              console.log("Erreur...")
            }
          } else { // movie not found
            //console.log(o.err)
            var card = renderFilmCard({path: mov_path});
            root.append(card)
          }
        }).catch(err => {
          console.log(mov_path, err)
        })
        // s'il existe on lance le rendu
      } else if (film_o && film_o.path.indexOf(root_dir) == 0 && fs.existsSync(film_o.path)) {
        var card = renderFilmCard(film_o);
        root.append(card)
        // s'il existe mais est mal formé, il y a un problème...
      } else {
        console.log("Erreur non prévue :-S")
      }
    })
    $("#app").append(root)
  }).catch(err => {
    console.log(err)
  })
  Promise.all(myPromises).then(res_list => {
    if (res_list && res_list.length) console.log("Updating info from omdb for :", res_list)
    dblib.writeDB().then(res => console.log(res)).catch(err => console.log(err))
  }).catch(err => {
    console.log("Erreur dans un des getOMDBFilm:", err)
  })
}

function renderFilmCard(film_o) {
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

  return container
}

function createNavbar() {
  var nav = $('<div id="navbar"></div>')
  // ====== 1 ======= On ajoute le bouton de changement de dossier films
  var change_dir = $('<button class="dir_path mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--accent">' + dblib.getFilmDir() + '</button>')
  $("#select_root").on('change', ev => {
    if (ev.target.files.length) {
      var myrootdir = ev.target.files[0].path;
      console.log("dir:", myrootdir)
      $("#path_root").val(myrootdir)
    } else {
      console.log("Je n'ai pas trouvé de fichiers dans le dossier choisi !")
    }
  })
  change_dir.click(e => {
    var ok = $('#ok_change_root')
    ok.unbind("click");
    ok.click(e => {
      var myrootdir = $("#path_root").val();
      console.log("val:", myrootdir)
      // on change le path vers les films
      dblib.setFilmDir(myrootdir).then(_ => {
        document.querySelector("#change_root").close()
        // on relance le rendu dashboard
        renderDashboard()
      }).catch(err => {
        console.log("Cannot change root path films to " + myrootdir, err)
        document.querySelector("#change_root").close()
      })
    })
    document.querySelector("#change_root").showModal();
  })

  // ====== 2 ======= On ajoute les boutons pour zoomer
  var zIn = $('<button class="zoomin mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect"><i class="material-icons">add</i></button>')
  zIn.click(e => {
    e.stopPropagation()
    ui.zoomIn()
  });
  var zOut = $('<button class="zoomout mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect">-</button>')
  zOut.click(e => {
    e.stopPropagation()
    ui.zoomOut()
  });

  // ====== 3 ======= On ajoute le bouton pour rafraîchir
  var reload = $('<button class="reload mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--accent"><i class="fa fa-refresh" aria-hidden="true"></i></button>')
  reload.click(e => {
    e.stopPropagation()
    renderDashboard()
  })

  nav.append(change_dir)
  nav.append(zIn)
  nav.append(zOut)
  nav.append(reload)
  return nav
}

function createChangeInfoButton(film_o) {
  var button = $('<button class="edition_buttons change_poster mdl-button mdl-js-button mdl-button--fab mdl-button--colored"><i class="fa fa-info" aria-hidden="true"></i></button>')
  button.click(e => {
    e.stopPropagation();
    var title = film_o.title;
    title = (film_o.omdb && film_o.omdb.Title) ? film_o.omdb.Title : title;
    title = (title) ? title : "";
    if (title) $("#dialog_info_title").val(title)
    else $("#dialog_info_title").val("")

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
    poster_text.html("Colle ici l'url vers le nouveau poster du film <b>" + title + "</b>");

    var poster_path = "";
    if (film_o.omdb && film_o.omdb.localPoster) poster_path = film_o.omdb.localPoster;
    else if (film_o.omdb && film_o.omdb.Poster) poster_path = film_o.omdb.Poster;
    dialog.find("#dialog_poster_url").val(poster_path);

    // quand on clicke sur ok pour changer le poster voilà ce qui se passe :
    var ok = $('#ok_change_poster')
    ok.unbind("click");
    ok.click(e => {
      var url_poster = $("#dialog_poster_url").val();
      if (/^https?\:\/\//gi.test(url_poster)) {
        var hash = dblib.getId(film_o)
        if ($("#" + hash).find(".poster_empty")) film_o.title = title; // on met un titre par défaut
        dblib.updatePoster(film_o, url_poster).then(o => {
          var title = o.title;
          if (!title) title = (o.omdb && o.omdb.Title) ? o.omdb.Title : title;
          if (!title) title = omdb.normFileTitle(path.basename(o.path));
          if (!o.title && title) {
            o.title = title
            dblib.updateFilmInfo(o.path, o)
          }
          console.log("poster mis à jour", o.localPoster)
          // on met à jour l'image dans l'UI
          var myel = $("#" + hash).find(".poster");
          if (!myel.length) {
            myel = $("#" + hash).find(".poster_empty");
            if (myel.length) {
              myel.eq(0).empty();
              myel.eq(0).removeClass("poster_empty")
              myel.eq(0).addClass("poster")
              myel.eq(0).css('background-image', 'url(\"./cache/omdb/' + path.basename(o.localPoster) + '\")')
              myel.eq(0).append("<span class='play'><i class=\"fa fa-play-circle\" aria-hidden=\"true\"></i></span>")
              $("#" + hash).find(".main_title_empty").eq(0).remove()
              $("#" + hash).append(`<div class="main_title">${title}</div>`)
            }
          } else {
            myel.eq(0).css('background-image', 'url(\"./cache/omdb/' + path.basename(o.localPoster) + '\")')
          }
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
module.exports.renderDashboard = renderDashboard;
