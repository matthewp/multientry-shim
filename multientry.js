(function () {
  "use strict";

  if (typeof IDBIndex.prototype.multiEntry !== 'undefined') {
    return;  // Supported! Exit.
  }

  var DBNAME = '_multientry_pollyfill_',
      OSNAME = 'me-values';

  function openDatabase(callback) {
    var req = window.indexedDB.open(DBNAME, 1);

    req.onupgradeneeded = function(e) {
      var db = e.target.result;

      if(!db.objectStoreNames.contains(OSNAME)) {
        var objectStore = db.createObjectStore(OSNAME, { autoIncrement: true });
        objectStore.createIndex('IX_key', 'key', { unique: false });
        objectStore.createIndex('IX_value', 'value', { unique: false });
      }
    };

    req.onsuccess = function(e) {
      callback(e.target.result);
    };
  }

  IDBObjectStore.prototype.createIndex = (function() {
    var createIndex = IDBObjectStore.prototype.createIndex;

    return function(name, keyPath, optionalParameters) {
      if(optionalParameters && optionalParameters.multiEntry) {
        // TODO Save that this is a multiEntry.
        openDatabase(function(db) {
          
        });
      }
    };

  })();

  IDBObjectStore.prototype.put = (function () {
    var put = IDBObjectStore.prototype.put;

    return function (value) {
      var req = put.apply(this, arguments),
          onsuccess;

      req.onsuccess = function (e) {
        // TODO do the things to save the multi entries.
        var key = e.target.result;
        var self = this, args = arguments;

        openDatabase(function(db) {
          var objectStore = db.transaction([OSNAME], 'readwrite').objectStore(OSNAME);
          // TODO We need the keyPath to know where the values lie.
          // TODO We need to grab all of the current values to know which are new,
          // and which no longer exist.

          if(onsuccess) {
            onsuccess.apply(self, args);
          }
        });
      };

      Object.defineProperty(req, 'onsuccess', {
        set: function (value) {
          onsuccess = value;
        }
      });

      return req;
    };

  })();

})();
