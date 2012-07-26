(function () {
  "use strict";

  if (typeof IDBIndex.prototype.multiEntry !== 'undefined') {
    return;  // Supported! Exit.
  }

  IDBObjectStore.prototype.put = (function () {
    var put = IDBObjectStore.prototype.put;

    return function () {
      var req = put.apply(this, arguments),
          onsuccess;

      req.onsuccess = function () {
        // TODO do the things to save the multi entries.


        onsuccess.apply(this, arguments);
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