/* app.sync.js - live cloud sync via Firebase Auth (Google) + Firestore.
 *
 * Mirrors the Budget Planner's household-sync pattern exactly (same
 * Firebase project, "kyodububb" - same trusted Google login, zero new
 * setup) but in its OWN Firestore collection ("yarnParties", not
 * "households") so the two apps' data can never collide even though they
 * share a project. "Household" is renamed "Party" in the visible copy to
 * fit a D&D app; the code/collection naming stays close to Budget's so
 * anyone who's read app.sync.js over there can read this one too.
 *
 * Sign in with Google; the party owner invites people by email (their DM,
 * fellow players). Anyone whose email is on the members list sees the same
 * character roster + campaigns automatically, on every device.
 *
 * Only active when the Firebase SDK + config are present (see yarn.html) -
 * opening yarn.html straight from disk with no config still works fully
 * offline, exactly like today.
 *
 * This module never touches app.ui.js's render cycle. It mounts its own
 * persistent widget onto document.body once, the same way app.wizard.js
 * mounts its own overlay - so a full YARN.UI.render() elsewhere on the page
 * can never wipe out sync state or steal focus from an open sync panel.
 */
(function (YARN) {
  "use strict";

  YARN.FIREBASE_CONFIG = YARN.FIREBASE_CONFIG || window.__YARN_FB_CONFIG__ || null;
  YARN.hasSync = function () {
    return !!(window.firebase && YARN.FIREBASE_CONFIG && YARN.FIREBASE_CONFIG.apiKey &&
      firebase.auth && firebase.firestore);
  };
  if (!YARN.hasSync()) { YARN.initSync = function () {}; return; }

  var COLLECTION = "yarnParties";

  var db = null, auth = null, user = null;
  var docRef = null, unsub = null;
  var connected = false, applyingRemote = false, pushTimer = null;
  // The exact state string we last pushed, so we recognise our own write
  // echoing back and do NOT re-render on top of it (that would yank focus
  // out of whatever field you're typing in). Plus a holding slot for a
  // genuine remote change that arrives while you're mid-edit.
  var lastPushedState = null, pendingRemote = null;

  var panel = null; // the whole widget's root node, appended to <body> once

  function $(sel) { return panel ? panel.querySelector(sel) : null; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }

  // Are you actively typing in a text field right now? Yarn's sheet fields
  // are plain <input>/<select>/<textarea> (not a grid like Budget's bill
  // table), so this checks anywhere on the page, not just inside a table.
  function editingField() {
    var ae = document.activeElement;
    return !!(ae && ae.matches && ae.matches("input,select,textarea") &&
              !(panel && panel.contains(ae))); // typing inside our own panel is fine to interrupt
  }

  function status(msg) { var n = $("#syncStatus"); if (n) { n.textContent = msg; } }
  function show(id) {
    ["syncSignedOut", "syncNoParty", "syncActive"].forEach(function (s) {
      var el = $("#" + s);
      if (el) { el.classList.toggle("hidden", s !== id); }
    });
  }

  function ensureFb() {
    if (db) { return; }
    firebase.initializeApp(YARN.FIREBASE_CONFIG);
    db = firebase.firestore();
    auth = firebase.auth();
    try { db.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* fine offline */ }
  }

  function renderMembers(list) {
    var ul = $("#syncMembers");
    if (!ul) { return; }
    ul.innerHTML = list.map(function (e) {
      return "<li>" + esc(e) + (user && e === user.email.toLowerCase() ? " (you)" : "") + "</li>";
    }).join("") || '<li class="muted">just you</li>';
  }

  function applyRemote(data) {
    try {
      if (data.state) {
        // Our own write bouncing back off Firestore - don't re-render, that
        // would steal focus mid-typing. Members/status still refresh below.
        if (data.state === lastPushedState) {
          renderMembers(data.members || []);
          status("Saved to cloud - " + new Date().toLocaleTimeString());
          return;
        }
        // A real change from another device. If you're mid-edit, stash it
        // and apply once you leave the field (see flushPendingRemote).
        if (editingField()) {
          pendingRemote = data;
          renderMembers(data.members || []);
          status("Update from another device - applies when you finish editing.");
          return;
        }
        pendingRemote = null;
        var st = JSON.parse(data.state);
        if (st && st.characters) {
          applyingRemote = true;
          YARN.state = YARN.normalize(st);
          YARN.save();
          YARN.UI.render();
          applyingRemote = false;
        }
      }
      renderMembers(data.members || []);
      status("Up to date - synced " + new Date().toLocaleTimeString());
    } catch (e) { applyingRemote = false; }
  }

  // Once focus genuinely leaves the field, apply any deferred remote
  // update. Deferred a tick because focus often just hops to the next field.
  function flushPendingRemote() {
    if (!pendingRemote) { return; }
    setTimeout(function () {
      if (pendingRemote && !editingField()) {
        var data = pendingRemote; pendingRemote = null; applyRemote(data);
      }
    }, 200);
  }

  function schedulePush() {
    if (!connected || applyingRemote || !docRef) { return; }
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      var payload = JSON.stringify(YARN.state);
      lastPushedState = payload;
      docRef.set({
        state: payload,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).then(function () {
        status("Saved to cloud - " + new Date().toLocaleTimeString());
      }).catch(function (e) { status("Save failed: " + (e && e.code ? e.code : "error")); });
    }, 600);
  }

  function attach(ref, seedIfEmpty) {
    docRef = ref; connected = true;
    if (unsub) { unsub(); unsub = null; }
    ref.get().then(function (snap) {
      if (snap.exists && snap.data() && snap.data().state) { applyRemote(snap.data()); }
      else if (seedIfEmpty) { schedulePush(); }
      show("syncActive");
      var em = $("#syncEmail"); if (em) { em.textContent = user.email; }
      unsub = ref.onSnapshot(function (s) {
        if (s.metadata.hasPendingWrites) { return; }
        if (s.exists && s.data()) { applyRemote(s.data()); }
      }, function (e) { status("Sync error: " + (e && e.code ? e.code : "error")); });
    }).catch(function (e) { status("Could not open party: " + (e && e.code ? e.code : "error")); });
  }

  function findParty() {
    var email = user.email.toLowerCase();
    status("Looking for your party...");
    db.collection(COLLECTION).where("members", "array-contains", email).limit(1).get()
      .then(function (qs) {
        if (!qs.empty) {
          attach(qs.docs[0].ref, false);
        } else {
          show("syncNoParty");
          var em = $("#syncEmail2"); if (em) { em.textContent = user.email; }
          status("No party yet for " + user.email + ".");
        }
      }).catch(function (e) { status("Lookup failed: " + (e && e.code ? e.code : "error")); });
  }

  function createParty() {
    var email = user.email.toLowerCase();
    var ref = db.collection(COLLECTION).doc(user.uid);
    // Never clobber an existing party (that would wipe members/invites).
    ref.get().then(function (snap) {
      if (snap.exists) {
        status("You already have a party - reconnected. Your invites are intact.");
        attach(ref, false);
        return;
      }
      ref.set({
        owner: user.uid,
        members: [email],
        state: JSON.stringify(YARN.state),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(function () {
        status("Party created. Invite your DM/players by email below.");
        attach(ref, true);
      }).catch(function (e) { status("Create failed: " + (e && e.code ? e.code : "error")); });
    }).catch(function (e) { status("Create failed: " + (e && e.code ? e.code : "error")); });
  }

  function invite() {
    var input = $("#syncInviteEmail");
    var email = ((input && input.value) || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { status("Enter a valid email address."); return; }
    if (!docRef) { status("Create your party first."); return; }
    docRef.update({
      members: firebase.firestore.FieldValue.arrayUnion(email)
    }).then(function () {
      status(email + " invited. Tap 'Copy invite link' to send them the link.");
    }).catch(function (e) { status("Invite failed: " + (e && e.code ? e.code : "error")); });
  }

  function copyInviteLink() {
    var url = location.origin + location.pathname;
    var inputEl = $("#syncInviteEmail");
    var who = ((inputEl && inputEl.value) || "").trim();
    var msg = "Join our Yarn party: " + url + "\n" +
      'Open it, tap "Cloud Sync" then "Sign in with Google"' +
      (who ? " using " + who : " with the email I invited") +
      " - our shared characters will load automatically.";
    function done() { status("Invite link copied. Paste it into a text or email."); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(msg).then(done, function () { status("Copy failed - link is: " + url); });
    } else {
      var t = document.createElement("textarea");
      t.value = msg; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); done(); } catch (e) { status("Copy failed - link is: " + url); }
      document.body.removeChild(t);
    }
  }

  function signIn() {
    ensureFb();
    var provider = new firebase.auth.GoogleAuthProvider();
    status("Opening Google sign-in...");
    auth.signInWithPopup(provider).catch(function (e) {
      // Popups are often blocked in installed PWAs / mobile - fall back to redirect.
      if (e && (e.code === "auth/popup-blocked" || e.code === "auth/cancelled-popup-request" ||
                e.code === "auth/operation-not-supported-in-this-environment")) {
        auth.signInWithRedirect(provider);
      } else {
        status("Sign-in failed: " + (e && e.code ? e.code : "error"));
      }
    });
  }

  function signOut() {
    if (unsub) { unsub(); unsub = null; }
    connected = false; docRef = null;
    auth.signOut();
    show("syncSignedOut"); status("Signed out. This device is now local-only.");
  }

  // ---- widget markup + mount --------------------------------------------
  function panelMarkup() {
    return '' +
      '<button id="syncToggle" class="ghost sync-toggle" type="button" aria-expanded="false">' +
        "\u2601 Cloud Sync</button>" +
      '<div id="syncPanel" class="panel sync-panel hidden">' +
        "<h2>Cloud Sync</h2>" +

        '<div id="syncSignedOut">' +
          '<p class="muted">Sign in to sync your characters &amp; campaigns across every device. ' +
          "Then invite your DM or fellow players by email - your party's roster updates automatically everywhere.</p>" +
          '<button id="syncSignIn" class="primary" type="button">Sign in with Google</button>' +
        "</div>" +

        '<div id="syncNoParty" class="hidden">' +
          '<p class="muted">Signed in as <strong id="syncEmail2"></strong>. Create your party to start syncing, ' +
          "or ask whoever set it up to invite this email address.</p>" +
          '<button id="syncCreate" class="primary" type="button">Create our party</button> ' +
          '<button id="syncSignOut2" class="ghost" type="button">Sign out</button>' +
        "</div>" +

        '<div id="syncActive" class="hidden">' +
          '<p class="muted">Synced as <strong id="syncEmail"></strong>. Characters &amp; campaigns update ' +
          "automatically across every device signed in to your party.</p>" +
          '<div class="field"><label for="syncInviteEmail">Invite someone (their Google email)</label>' +
            '<input id="syncInviteEmail" type="email" autocomplete="off" placeholder="dm@gmail.com"></div>' +
          '<button id="syncInvite" class="ghost" type="button">Invite</button> ' +
          '<button id="syncCopyLink" class="ghost" type="button">Copy invite link</button>' +
          '<p class="muted" style="font-size:.75rem;margin:.6rem 0 .2rem">People with access:</p>' +
          '<ul id="syncMembers" class="linelist"></ul>' +
          '<button id="syncPush" class="ghost" type="button">Upload this device\u2019s data now</button> ' +
          '<button id="syncSignOut" class="ghost" type="button">Sign out</button>' +
        "</div>" +

        '<p id="syncStatus" class="muted" style="font-size:.75rem;margin-top:.6rem"></p>' +
      "</div>";
  }

  function togglePanel() {
    var p = $("#syncPanel"), btn = $("#syncToggle");
    var willShow = p.classList.contains("hidden");
    p.classList.toggle("hidden", !willShow);
    btn.setAttribute("aria-expanded", String(willShow));
  }

  function mount() {
    panel = document.createElement("div");
    panel.className = "sync-widget";
    panel.innerHTML = panelMarkup();
    document.body.appendChild(panel);

    $("#syncToggle").addEventListener("click", togglePanel);
    $("#syncSignIn").addEventListener("click", signIn);
    $("#syncCreate").addEventListener("click", createParty);
    $("#syncInvite").addEventListener("click", invite);
    $("#syncCopyLink").addEventListener("click", copyInviteLink);
    $("#syncPush").addEventListener("click", function () {
      if (!connected) { status("Not connected."); return; }
      schedulePush(); status("Uploading this device's data...");
    });
    $("#syncSignOut").addEventListener("click", signOut);
    $("#syncSignOut2").addEventListener("click", signOut);

    // Apply any remote update we held back mid-edit, once focus moves on.
    document.addEventListener("focusout", flushPendingRemote);
  }

  YARN.initSync = function () {
    mount();
    ensureFb();

    // Piggyback the existing save hook (app.core.js calls YARN.onSave after
    // every local save) instead of monkey-patching YARN.save - the hook was
    // already sitting there unused, built for exactly this.
    var priorOnSave = YARN.onSave;
    YARN.onSave = function (state) {
      if (typeof priorOnSave === "function") { priorOnSave(state); }
      schedulePush();
    };

    // Complete any redirect-based sign-in, then watch auth state.
    auth.getRedirectResult().catch(function () {});
    auth.onAuthStateChanged(function (u) {
      user = u;
      if (u) { findParty(); }
      else { connected = false; show("syncSignedOut"); }
    });
  };
})(window.YARN = window.YARN || {});
