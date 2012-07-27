(function(undefined) {
  "use strict";

  if(typeof IDBIndex.prototype.multiEntry !== 'undefined') {
    return;  // Supported! Exit.
  }

  // Allow legacy suppot for IDBTransation.READ* properties.
  var READ_ONLY = IDBTransaction.READ_ONLY || 'readonly',
      READ_WRITE = IDBTransaction.READ_WRITE || 'readwrite';

  var DBNAME = '_multientry_pollyfill_',
      VALUESOS = 'values',
      INDEXOS = 'indices';

  var multiEntryItems = [];

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

  function hijackSetter(func, args, value) {
    var osName = this.name, dbName = this.transaction.database.name;

    var indices = multiEntryItems.filter(function(item) {
      return item.database === dbName && item.objectStore === osName;
    });

    if(!indices.length) {
      // This objectStore doesn't have any multiEntry indices.
      return func.apply(this, args);
    }

    var currentValues = indices.map(function(item) {
      return {
        keyPath: item.keyPath,
        values: value[item.keyPath]
      };
    }).reduce(function(a, b) {
      a[b.keyPath] = b.values;

      return a;
    }, {});

    var req = func.apply(this, args),
        onsuccess;

    req.onsuccess = function(e) {
      var key = e.target.result;
      var self = this, args = arguments;

      openDatabase(function(db) {
        var objectStore = db.transaction([OSNAME], 'readwrite').objectStore(OSNAME),
            index = objectStore.index('IX_key');

        index.openCursor(IDBKeyRange.only(key)).onsuccess = function(e) {
          var cursor = e.target.result;
          if(cursor) {
            var item = cursor.value;

            if(value[item.keyPath] && value[item.keyPath].indexOf(item.value) !== -1) {
              // This value is present.
              var indexOfItem = currentValues[item.keyPath].indexOf(item.value);
              currentValues[item.keyPath].splice(indexOfItem, 1);
            } else {
              // item value doesn't exist in the object, remove it.
              cursor.delete();
            }

            cursor.continue();
            return;
          }

          // Now only stuff remaining is what needs to be added.
          var count = Object.keys(currentValues).map(function(keyPath) {
            return currentValues[keyPath].length;
          }).reduce(function(a, b) {
            return a + b;
          });

          Object.keys(currentValues).forEach(function(keyPath) {
            currentValues[keyPath].forEach(function(itemValue) {
              objectStore.put({
                key: key,
                keyPath: keyPath,
                value: itemValue
              }).onsuccess = function(e) {
                count--;

                if(!count && onsuccess) {
                  // All done.
                  onsuccess.apply(self, args);
                }
              };
            });
          });
        };
      });
    };

    Object.defineProperty(req, 'onsuccess', {
      set: function(value) {
        onsuccess = value;
      }
    });

    return req;
  }

  IDBObjectStore.prototype.add = (function() {
    var add =IDBObjectStore.prototype.add;

    return function(value) {
      return hijackSetter.call(this, add, arguments, value);
    };

  })();

  IDBObjectStore.prototype.put = (function() {
    var put = IDBObjectStore.prototype.put;

    return function(value) {
      return hijackSetter.call(this, put, arguments, value);
    };

  })();

  IDBIndex.prototype.openCursor = (function() {
    var openCursor = IDBIndex.prototype.openCursor;

    return function(range, direction) {
      var idxName = this.name, osName = this.objectStore.name,
          dbName = this.objectStore.transaction.database.name,
          objectStore = this.objectStore;

      var indexItem = multiEntryItems.filter(function(item) {
        return item.database === dbName
          && item.objectStore === osName
          && item.index === idxName;
      })[0];

      if(!indexItem) {
        return openCursor.apply(this, arguments);
      }

      var req = Object.create(IDBRequest.prototype);

      openDatabase(function(db) {
        var valuesObjectStore = db.transaction([VALUESOS], READ_WRITE).objectStore(VALUESOS),
            index = valuesObjectStore.index('IX_value');

        index.openCursor(range, directon).onsuccess = function(e) {
          var valueCursor = e.target.result;
          if(valueCursor) {
            objectStore.get(valueCursor.value.key).onsuccess = function(itemValue) {
              var f = e;
              f.target.result.key = valueCursor.value.key;
              f.target.result.value = itemValue;
              f.target.result.continue = function() {
                valueCursor.continue.apply(valueCursor, arguments);
              };

              if(req.onsuccess) {
                req.onsuccess(f);
              }
            }
          } else {
            if(req.onsuccess) {
              req.onsuccess(e);
            }
          }
        };
      });

      return req;
    };

  });

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
