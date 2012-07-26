(function(undefined) {
  "use strict";

  if(typeof IDBIndex.prototype.multiEntry !== 'undefined') {
    return;  // Supported! Exit.
  }

  var READ_ONLY = IDBTransaction.READ_ONLY || 'readonly',
      READ_WRITE = IDBTransaction.READ_WRITE || 'readwrite';

  var DBNAME = '_multientry_pollyfill_',
      VALUESOS = 'values',
      INDEXOS = 'indices';

  var multiEntryItems = [];

  /*
  * Return the first item in an array that meets a condition.
  */
  function find(array, iterator, context) {
    for(var i = 0; i < array.length; i++) {
      var item = array[i];
      var result = iterator.call(context, item, i, array);
      if(result) {
        return item;
      }
    }

    return undefined;
  }

  function openDatabase(callback) {
    var req = window.indexedDB.open(DBNAME, 1);

    req.onupgradeneeded = function(e) {
      var db = e.target.result;

      if(!db.objectStoreNames.contains(INDEXOS)) {
        var indexObjectStore = db.createObjectStore(INDEXOS, { autoIncrement: true });
      }

      if(!db.objectStoreNames.contains(VALUESOS)) {
        var valuesObjectStore = db.createObjectStore(VALUESOS, { autoIncrement: true });
        valuesObjectStore.createIndex('IX_key', 'key', { unique: false });
        valuesObjectStore.createIndex('IX_value', 'value', { unique: false });
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
        var dbName = this.transaction.db.name,
            osName = this.name;

        openDatabase(function(db) {
          var indexObjectStore = db.transaction([INDEXOS], READ_WRITE).objectStore(INDEXOS);
          var item = {
            database: dbName,
            objectStore: osName,
            index: name,
            keyPath: keyPath
          };
          multiEntryItems.push(item);
          indexObjectStore.put(item);
        });
      }

      return createIndex.apply(this, arguments);
    };

  })();

  IDBObjectStore.prototype.put = (function() {
    var put = IDBObjectStore.prototype.put;

    return function(value) {
      var osName = this.name;

      var indices = multiEntryItems.filter(function(item) {
        return item.objectStore.name == osName;
      });

      if(!arr.length) {
        return put.apply(this, arguments);
      }

      var req = put.apply(this, arguments),
          onsuccess;

      req.onsuccess = function(e) {
        // TODO do the things to save the multi entries.
        var key = e.target.result;
        var self = this, args = arguments;

        openDatabase(function(db) {
          var objectStore = db.transaction([OSNAME], 'readwrite').objectStore(OSNAME);
          // TODO We need the keyPath to know where the values lie.
          // TODO We need to grab all of the current values to know which are new,
          // and which no longer exist.
          var index = objectStore.index('IX_key'),
              currentValues = [];
          index.openCursor(IDBKeyRange.only(key)).onsuccess = function(e) {
            var cursor = e.target.result;
            if(cursor) {
              currentValues.push(cursor.value);
              cursor.continue();

              return;
            }

            // TODO Find the differences, delete some, insert others.
          };

          if(onsuccess) {
            onsuccess.apply(self, args);
          }
        });
      };

      Object.defineProperty(req, 'onsuccess', {
        set: function(value) {
          onsuccess = value;
        }
      });

      return req;
    };

  })();

  /* After the page loads, open the database (creating it if necessary) and load
  * all of the keys into memory.
  */
  window.addEventListener('load', function windowLoaded() {
    window.removeEventListener('load', windowLoaded);

    openDatabase(function(db) {
      var indexObjectStore = db.transaction([INDEXOS], READ_ONLY).objectStore(INDEXOS);
      indexObjectStore.openCursor().onsuccess = function(e) {
        var cursor = e.target.result;
        if(cursor) {
          multiEntryItems.push(cursor.value);
          cursor.continue();
        }
      };
    })

  }, false);

})();
