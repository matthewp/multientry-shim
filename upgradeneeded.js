(function(undefined) {
  "use strict";

  if(!webkitIDBDatabase || !webkitIDBDatabase.prototype.setVersion) {
    return;
  }

  webkitIDBFactory.prototype.open = (function() {
    var open = webkitIDBFactory.prototype.open,
        setVersion = webkitIDBDatabase.prototype.setVersion;

    return function(name, version) {
      var req = open.apply(this, arguments),
          onsuccess;

      var reqSuccess;
      reqSuccess = req.onsuccess = function(e) {
        var db = e.target.result;

        if(db.setVersion && Number(db.version) !== version) {
          var dbReq = setVersion.call(db, String(version));

          dbReq.onsuccess = function(e2) {
            var e3 = e2;
            e3.target.result = e2.target.result.db;

            if(req.onupgradeneeded) {
              req.onupgradeneeded(e3);
            }

            reqSuccess(e3);
          };

          return;
        }

        if(onsuccess) {
          onsuccess(e);
        }
      };

      Object.defineProperty(req, 'onsuccess', {
        set: function(value) {
          onsuccess = value;
        }
      });

      return req;
    };

  })();

  Object.defineProperty(webkitIDBDatabase.prototype, 'setVersion', {
    value: undefined
  });

})();