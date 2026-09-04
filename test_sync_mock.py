"""test_sync_mock.py - cloud sync (Google auth + Firestore) validated against a
MOCKED Firebase, mirroring the Budget Planner's test_auth_mock.py pattern.

Real gstatic.com/firebase network calls are blocked in this environment (and
would be flaky/slow even if allowed), so every Firebase SDK script tag is
intercepted and replaced with an in-memory mock before yarn.html loads. This
tests the actual app.sync.js logic - sign-in flow, party create/join,
invites, and the focus-preserving remote-update guard - without touching a
real backend.

    .venv\\Scripts\\python -u test_sync_mock.py
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
URL = (HERE / "yarn.html").as_uri()

# Minimal Firebase mock (auth + firestore), same shape as Budget's mock.
MOCK = r"""
window.__s = { doc:null, members:[], authCb:null, snapCb:null, user:null, queryEmail:undefined, lastSet:null };
window.firebase = {
  initializeApp:function(){return {};},
  auth:function(){
    return {
      onAuthStateChanged:function(cb){ window.__s.authCb=cb; cb(window.__s.user); },
      signInWithPopup:function(){ window.__s.user={uid:'u1',email:'Dan@Gmail.com',
        get token(){return {email:'dan@gmail.com'};}};
        window.__s.user.email='Dan@Gmail.com';
        if(window.__s.authCb) window.__s.authCb(window.__s.user);
        return Promise.resolve({user:window.__s.user}); },
      signInWithRedirect:function(){return Promise.resolve();},
      getRedirectResult:function(){return Promise.resolve({});},
      signOut:function(){ window.__s.user=null; if(window.__s.authCb) window.__s.authCb(null); return Promise.resolve(); }
    };
  },
  firestore:function(){
    var fs={};
    fs.collection=function(){return fs;};
    fs.where=function(f,op,val){ window.__s.queryEmail=val; return fs; };
    fs.limit=function(){return fs;};
    fs.doc=function(){return fs;};
    fs.get=function(){
      if(window.__s.queryEmail!==undefined){
        var qe=window.__s.queryEmail; window.__s.queryEmail=undefined;
        var match=window.__s.doc && window.__s.members.indexOf(qe)>=0;
        return Promise.resolve({empty:!match, docs: match?[{ref:fs,data:function(){return window.__s.doc;}}]:[]});
      }
      return Promise.resolve({exists:!!window.__s.doc, data:function(){return window.__s.doc;}});
    };
    fs.set=function(obj,opts){ window.__s.doc=Object.assign({},window.__s.doc||{},obj);
      if(obj.members) window.__s.members=obj.members.slice(); window.__s.lastSet=obj; return Promise.resolve(); };
    fs.update=function(obj){ if(obj.members&&obj.members.__u){ obj.members.__u.forEach(function(e){
        if(window.__s.members.indexOf(e)<0) window.__s.members.push(e); }); window.__s.doc.members=window.__s.members.slice(); }
      else Object.assign(window.__s.doc,obj); return Promise.resolve(); };
    fs.onSnapshot=function(cb){ window.__s.snapCb=cb; return function(){}; };
    fs.enablePersistence=function(){return Promise.resolve();};
    return fs;
  }
};
firebase.auth.GoogleAuthProvider=function(){};
firebase.firestore.FieldValue={ serverTimestamp:function(){return 'ts';},
  arrayUnion:function(){return {__u:Array.prototype.slice.call(arguments)};} };
"""


def route_mock(route):
    route.fulfill(status=200, content_type="application/javascript", body=MOCK)


def main() -> int:
    failures = []

    def check(label, cond):
        print(("  PASS " if cond else "  FAIL ") + label)
        if not cond:
            failures.append(label)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="msedge")
        ctx = browser.new_context(permissions=["clipboard-read", "clipboard-write"])
        page = ctx.new_page()
        page.route("**/firebasejs/**/firebase-app-compat.js", route_mock)
        page.route("**/firebasejs/**/firebase-auth-compat.js", route_mock)
        page.route("**/firebasejs/**/firebase-firestore-compat.js", route_mock)
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))

        page.goto(URL)
        page.evaluate("() => { localStorage.clear(); }")
        page.reload()

        print("  -- widget mounts + starts signed out --")
        check("sync toggle button exists", page.query_selector("#syncToggle") is not None)
        page.click("#syncToggle")
        check("panel opens on toggle", page.is_visible("#syncPanel"))
        check("starts signed out", page.is_visible("#syncSignedOut"))

        print("\n  -- sign in -> no party yet -> create one --")
        page.click("#syncSignIn")
        page.wait_for_selector("#syncNoParty:not(.hidden)")
        print("  signed in as:", page.inner_text("#syncEmail2"))
        page.click("#syncCreate")
        page.wait_for_selector("#syncActive:not(.hidden)")
        page.wait_for_timeout(900)
        print("  active; synced as:", page.inner_text("#syncEmail"), "| status:", page.inner_text("#syncStatus"))
        seeded = page.evaluate("() => window.__s.doc && JSON.parse(window.__s.doc.state).characters")
        check("cloud seeded with Yarn state (has a characters array)", seeded is not None)

        print("\n  -- invite a party member --")
        page.fill("#syncInviteEmail", "DM@Gmail.com")
        page.click("#syncInvite")
        page.wait_for_timeout(300)
        members = page.evaluate("() => window.__s.members")
        print("  members after invite:", members)
        check("invite lowercases + adds the email", "dm@gmail.com" in members)

        print("\n  -- re-clicking Create must NOT wipe existing members (regression guard) --")
        page.evaluate("document.querySelector('#syncNoParty').classList.remove('hidden')")
        page.click("#syncCreate")
        page.wait_for_timeout(600)
        members2 = page.evaluate("() => window.__s.members")
        check("re-create keeps the invited member", "dm@gmail.com" in members2)
        check("re-create keeps the owner", "dan@gmail.com" in members2)

        print("\n  -- copy invite link --")
        page.fill("#syncInviteEmail", "dm@gmail.com")
        page.click("#syncCopyLink")
        page.wait_for_timeout(300)
        clip = page.evaluate("() => navigator.clipboard.readText()")
        check("invite link mentions the app + invited email",
              "yarn.html" in clip.lower() and "dm@gmail.com" in clip)

        print("\n  -- remote update from another device applies immediately when idle --")
        page.evaluate(
            """() => {
                const st = YARN.blankState();
                st.characters.push(Object.assign(YARN.blankCharacter(), {name: 'FROM DM'}));
                window.__s.snapCb({ metadata:{hasPendingWrites:false},
                  exists:true, data:()=>({ state: JSON.stringify(st), members: window.__s.members }) });
            }"""
        )
        page.wait_for_timeout(200)
        names = page.evaluate("() => YARN.state.characters.map(c => c.name)")
        check("remote character landed in local state", "FROM DM" in names)

        print("\n  -- remote update mid-typing is deferred until focus leaves the field --")
        page.evaluate(
            """() => {
                const c = YARN.blankCharacter();
                c.name = 'Local Edit In Progress';
                YARN.state.characters.push(c);
                YARN.state.ui.activeCharId = c.id;
                const camp = YARN.blankCampaign();
                camp.name = 'Test Campaign';
                YARN.state.campaigns.push(camp);
                YARN.state.ui.activeCampaignId = camp.id;
                YARN.getProgress(camp.id, c.id);
                YARN.save();
                YARN.UI.render();
            }"""
        )
        page.click('input[data-model="char.name"]')
        page.evaluate(
            """() => {
                const st = YARN.blankState();
                st.characters.push(Object.assign(YARN.blankCharacter(), {name: 'SECOND REMOTE'}));
                window.__s.snapCb({ metadata:{hasPendingWrites:false},
                  exists:true, data:()=>({ state: JSON.stringify(st), members: window.__s.members }) });
            }"""
        )
        page.wait_for_timeout(150)
        still_focused = page.evaluate(
            "() => document.activeElement && document.activeElement.getAttribute('data-model')"
        )
        check("cursor NOT yanked out of the field while a remote update is pending",
              still_focused == "char.name")
        page.click("#syncToggle")  # move focus into the sync panel, away from the sheet field
        page.wait_for_timeout(400)
        names_after = page.evaluate("() => YARN.state.characters.map(c => c.name)")
        check("deferred remote update applies once focus leaves the field",
              "SECOND REMOTE" in names_after)

        print("\n  -- sign out --")
        page.click("#syncToggle")
        page.click("#syncSignOut")
        page.wait_for_selector("#syncSignedOut:not(.hidden)")

        if errs:
            print("JS ERRORS:", errs)
            failures.append("console errors: " + "; ".join(errs))

        browser.close()

    print("")
    if failures:
        print("test_sync_mock.py FAILED (" + str(len(failures)) + "): " + ", ".join(failures))
        return 1
    print("test_sync_mock.py PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
