(function() {
  "use strict";

  var Application = Object.create(null);

  Application.DBNAME = 'foodb';
  Application.OSNAME = 'foo';

  Application.openDatabase = function(callback) {
    var req = window.indexedDB.open(Application.DBNAME, 1);

    req.onupgradeneeded = function(e) {
      var db = e.target.result;

      if(!db.objectStoreNames.contains(Application.OSNAME)) {
        var objectStore = db.createObjectStore(Application.OSNAME, { autoIncrement: true });
        objectStore.createIndex('IX_states', 'states', { multiEntry: true });
      }
    };

    req.onsuccess = function(e) {
      callback(e.target.result);
    };
  };

  Application.deleteDatabase = function(callback) {
    var req = window.indexedDB.deleteDatabase(Application.DBNAME);

    req.onsuccess = function() {
      callback();
    };
  };

  this.Application = Application;
}).call(this);