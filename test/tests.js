describe('Get', function() {
  "use strict";

  var READ_ONLY = IDBTransaction.READ_ONLY || 'readonly',
      READ_WRITE = IDBTransaction.READ_WRITE || 'readwrite';

  var db;
  before(function(done) {
    Application.openDatabase(function(database) {
      db = database;

      var objectStore = db.transaction([Application.OSNAME], READ_WRITE).objectStore(Application.OSNAME);
      var req = objectStore.put({
        foo: "Bar",
        states: ["Kansas", "Alabama", "Kentucky", "Alaska", "New York"]
      });

      req.onsuccess = function() {
        done();
      };
    });
  });

  function getIndex() {
    var objectStore = db.transaction([Application.OSNAME], READ_ONLY).objectStore(Application.OSNAME);
    var index = objectStore.index('IX_states');

    return index;
  }

  it('openCursor with no parameter should retrieve all items in the index.', function(done) {
    var states = [], index = getIndex();

    index.openCursor().onsuccess = function(e) {
      var cursor = e.target.result;
      if(cursor) {
        states.push(cursor.value);
        cursor['continue']();
      } else {
        done(assert.equal(states.length, 5, 'The lengths are incorrect.'));
      }
    };
  });
});
