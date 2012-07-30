describe('Get', function() {
  "use strict";

  var db;
  before(function(done) {
    Application.openDatabase(function(database) {
      db = database;
      done();
    });
  });

  it('someting', function(done) {
    done(assert.ok(true));
  });
});
